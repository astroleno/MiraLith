export type CloudShellMicrobenchGpuStage =
  | "densityAndLightRaymarch"
  | "resolve"
  | "cloudComposite";

export interface CloudShellMicrobenchGpuFrame {
  frameId: number;
  densityAndLightRaymarchMs: number;
  resolveMs: number;
  cloudCompositeMs: number;
  disjoint: boolean;
}

export interface CloudShellMicrobenchGpuSummary {
  invalidFrameCount: number;
  p50Ms?: number;
  p95Ms?: number;
  sampleCount: number;
}

interface DisjointTimerQueryExtension {
  GPU_DISJOINT_EXT: number;
  TIME_ELAPSED_EXT: number;
}

interface PendingQuery {
  frameId: number;
  query: WebGLQuery;
  stage: CloudShellMicrobenchGpuStage;
}

interface PendingFrame {
  densityAndLightRaymarchMs?: number;
  resolveMs?: number;
  cloudCompositeMs?: number;
  disjoint: boolean;
}

function percentileNearestRank(values: number[], percentile: number) {
  const ordered = [...values].sort((left, right) => left - right);
  const rank = Math.max(0, Math.min(ordered.length - 1, Math.ceil(percentile * ordered.length) - 1));
  return ordered[rank];
}

export function summarizeCloudShellGpuFrames(
  frames: CloudShellMicrobenchGpuFrame[]
): CloudShellMicrobenchGpuSummary {
  const validTotals = frames
    .filter((frame) => !frame.disjoint)
    .map((frame) => frame.densityAndLightRaymarchMs + frame.resolveMs + frame.cloudCompositeMs)
    .filter(Number.isFinite);

  return {
    invalidFrameCount: frames.length - validTotals.length,
    p50Ms: validTotals.length > 0 ? percentileNearestRank(validTotals, 0.5) : undefined,
    p95Ms: validTotals.length > 0 ? percentileNearestRank(validTotals, 0.95) : undefined,
    sampleCount: validTotals.length
  };
}

export class CloudShellMicrobenchProfiler {
  private active: PendingQuery | null = null;
  private readonly extension: DisjointTimerQueryExtension | null;
  private readonly frames = new Map<number, PendingFrame>();
  private readonly pending: PendingQuery[] = [];

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension("EXT_disjoint_timer_query_webgl2") as DisjointTimerQueryExtension | null;
  }

  get supported() {
    return this.extension !== null;
  }

  begin(frameId: number, stage: CloudShellMicrobenchGpuStage) {
    if (!this.extension || this.active) {
      return false;
    }

    const query = this.gl.createQuery();
    if (!query) {
      return false;
    }

    const pendingQuery = { frameId, query, stage };
    this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
    this.active = pendingQuery;
    return true;
  }

  end() {
    if (!this.extension || !this.active) {
      return;
    }

    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  poll() {
    if (!this.extension) {
      return [] as CloudShellMicrobenchGpuFrame[];
    }

    const completed: CloudShellMicrobenchGpuFrame[] = [];
    for (let index = this.pending.length - 1; index >= 0; index -= 1) {
      const pending = this.pending[index];
      if (!this.gl.getQueryParameter(pending.query, this.gl.QUERY_RESULT_AVAILABLE)) {
        continue;
      }

      this.pending.splice(index, 1);
      const frame = this.frames.get(pending.frameId) ?? { disjoint: false };
      const disjoint = Boolean(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT));
      const resultNanoseconds = this.gl.getQueryParameter(pending.query, this.gl.QUERY_RESULT) as number;
      const durationMs = resultNanoseconds / 1_000_000;
      this.gl.deleteQuery(pending.query);

      frame.disjoint = frame.disjoint || disjoint || !Number.isFinite(durationMs);
      if (pending.stage === "densityAndLightRaymarch") {
        frame.densityAndLightRaymarchMs = durationMs;
      } else if (pending.stage === "resolve") {
        frame.resolveMs = durationMs;
      } else {
        frame.cloudCompositeMs = durationMs;
      }

      if (frame.densityAndLightRaymarchMs !== undefined &&
        frame.resolveMs !== undefined &&
        frame.cloudCompositeMs !== undefined) {
        completed.push({
          frameId: pending.frameId,
          densityAndLightRaymarchMs: frame.densityAndLightRaymarchMs,
          resolveMs: frame.resolveMs,
          cloudCompositeMs: frame.cloudCompositeMs,
          disjoint: frame.disjoint
        });
        this.frames.delete(pending.frameId);
      } else {
        this.frames.set(pending.frameId, frame);
      }
    }

    return completed;
  }

  dispose() {
    if (this.active) {
      if (this.extension) {
        this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
      }
      this.gl.deleteQuery(this.active.query);
      this.active = null;
    }
    for (const { query } of this.pending) {
      this.gl.deleteQuery(query);
    }
    this.pending.length = 0;
    this.frames.clear();
  }
}
