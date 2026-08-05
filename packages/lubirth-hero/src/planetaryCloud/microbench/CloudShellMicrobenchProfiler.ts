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
  stages: {
    cloudComposite: CloudShellMicrobenchGpuStageSummary;
    densityAndLightRaymarch: CloudShellMicrobenchGpuStageSummary;
    resolve: CloudShellMicrobenchGpuStageSummary;
  };
}

export interface CloudShellMicrobenchGpuStageSummary {
  p50Ms?: number;
  p95Ms?: number;
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

function summarizeStage(values: number[]): CloudShellMicrobenchGpuStageSummary {
  const validValues = values.filter(Number.isFinite);
  return {
    p50Ms: validValues.length > 0 ? percentileNearestRank(validValues, 0.5) : undefined,
    p95Ms: validValues.length > 0 ? percentileNearestRank(validValues, 0.95) : undefined
  };
}

export function summarizeCloudShellGpuFrames(
  frames: CloudShellMicrobenchGpuFrame[]
): CloudShellMicrobenchGpuSummary {
  const validFrames = frames.filter((frame) => !frame.disjoint &&
    Number.isFinite(frame.densityAndLightRaymarchMs) &&
    Number.isFinite(frame.resolveMs) &&
    Number.isFinite(frame.cloudCompositeMs));
  const validTotals = validFrames.map((frame) =>
    frame.densityAndLightRaymarchMs + frame.resolveMs + frame.cloudCompositeMs
  );

  return {
    invalidFrameCount: frames.length - validTotals.length,
    p50Ms: validTotals.length > 0 ? percentileNearestRank(validTotals, 0.5) : undefined,
    p95Ms: validTotals.length > 0 ? percentileNearestRank(validTotals, 0.95) : undefined,
    sampleCount: validTotals.length,
    stages: {
      cloudComposite: summarizeStage(validFrames.map((frame) => frame.cloudCompositeMs)),
      densityAndLightRaymarch: summarizeStage(
        validFrames.map((frame) => frame.densityAndLightRaymarchMs)
      ),
      resolve: summarizeStage(validFrames.map((frame) => frame.resolveMs))
    }
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

  /**
   * Starts a fresh measurement interval. Reading GPU_DISJOINT_EXT here clears
   * any historical disjoint state so a prior workload cannot invalidate this
   * window. Pending results are deliberately discarded because their render
   * target or readiness contract may belong to the previous window.
   */
  resetMeasurementWindow() {
    this.discardPendingQueries();
    if (!this.extension) {
      return false;
    }

    this.gl.getParameter(this.extension.GPU_DISJOINT_EXT);
    return true;
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

    const readyQueries = this.pending.filter((pending) =>
      Boolean(this.gl.getQueryParameter(pending.query, this.gl.QUERY_RESULT_AVAILABLE))
    );
    if (readyQueries.length === 0) {
      return [] as CloudShellMicrobenchGpuFrame[];
    }

    // GPU_DISJOINT_EXT covers every time value filled since the preceding
    // read. Check it once for this completed polling epoch before reading any
    // individual result; when it is set, every pending frame is unusable.
    if (Boolean(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT))) {
      return this.invalidatePendingEpoch();
    }

    const completed: CloudShellMicrobenchGpuFrame[] = [];
    for (const pending of readyQueries) {
      const pendingIndex = this.pending.indexOf(pending);
      if (pendingIndex === -1) {
        continue;
      }

      this.pending.splice(pendingIndex, 1);
      const frame = this.frames.get(pending.frameId) ?? { disjoint: false };
      const resultNanoseconds = this.gl.getQueryParameter(pending.query, this.gl.QUERY_RESULT) as number;
      const durationMs = resultNanoseconds / 1_000_000;
      this.gl.deleteQuery(pending.query);

      frame.disjoint = frame.disjoint || !Number.isFinite(durationMs);
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
    this.discardPendingQueries();
  }

  private invalidatePendingEpoch() {
    const invalidFrameIds = new Set(this.frames.keys());
    for (const { frameId } of this.pending) {
      invalidFrameIds.add(frameId);
    }
    this.discardPendingQueries();
    return [...invalidFrameIds]
      .sort((left, right) => left - right)
      .map((frameId) => ({
        frameId,
        densityAndLightRaymarchMs: Number.NaN,
        resolveMs: Number.NaN,
        cloudCompositeMs: Number.NaN,
        disjoint: true
      }));
  }

  private discardPendingQueries() {
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
