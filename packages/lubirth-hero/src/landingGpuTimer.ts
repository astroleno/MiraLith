export interface LandingGpuTimerSnapshot {
  lastMs?: number;
  p50Ms?: number;
  p95Ms?: number;
  sampleCount: number;
  supported: boolean;
}

export interface LandingGpuTimer {
  begin: () => void;
  dispose: () => void;
  end: () => void;
  poll: () => LandingGpuTimerSnapshot;
}

const MAX_PENDING_QUERIES = 6;
const MAX_SAMPLES = 120;

function percentile(values: number[], quantile: number) {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))];
}

export function createLandingGpuTimer(
  context: WebGLRenderingContext | WebGL2RenderingContext,
  enabled: boolean
): LandingGpuTimer {
  const webgl2 = typeof WebGL2RenderingContext !== "undefined" && context instanceof WebGL2RenderingContext
    ? context
    : null;
  const extension = enabled && webgl2
    ? webgl2.getExtension("EXT_disjoint_timer_query_webgl2")
    : null;
  const pending: WebGLQuery[] = [];
  const samples: number[] = [];
  let active: WebGLQuery | null = null;

  const snapshot = (): LandingGpuTimerSnapshot => ({
    lastMs: samples.at(-1),
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    sampleCount: samples.length,
    supported: Boolean(extension && webgl2)
  });

  if (!extension || !webgl2) {
    return {
      begin: () => undefined,
      dispose: () => undefined,
      end: () => undefined,
      poll: snapshot
    };
  }

  const poll = () => {
    while (pending.length > 0) {
      const query = pending[0];
      if (!webgl2.getQueryParameter(query, webgl2.QUERY_RESULT_AVAILABLE)) {
        break;
      }

      pending.shift();
      const disjoint = webgl2.getParameter(extension.GPU_DISJOINT_EXT) as boolean;
      if (!disjoint) {
        const elapsedNanoseconds = webgl2.getQueryParameter(query, webgl2.QUERY_RESULT) as number;
        samples.push(elapsedNanoseconds / 1_000_000);
        if (samples.length > MAX_SAMPLES) {
          samples.splice(0, samples.length - MAX_SAMPLES);
        }
      }
      webgl2.deleteQuery(query);
    }
    return snapshot();
  };

  return {
    begin: () => {
      poll();
      if (active || pending.length >= MAX_PENDING_QUERIES) {
        return;
      }
      const query = webgl2.createQuery();
      if (!query) {
        return;
      }
      active = query;
      webgl2.beginQuery(extension.TIME_ELAPSED_EXT, query);
    },
    dispose: () => {
      if (active) {
        webgl2.endQuery(extension.TIME_ELAPSED_EXT);
        webgl2.deleteQuery(active);
        active = null;
      }
      pending.splice(0).forEach((query) => webgl2.deleteQuery(query));
    },
    end: () => {
      if (!active) {
        return;
      }
      webgl2.endQuery(extension.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },
    poll
  };
}
