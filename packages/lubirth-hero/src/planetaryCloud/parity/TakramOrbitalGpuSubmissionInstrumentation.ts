import type {
  TakramOrbitalGpuStageName,
  TakramOrbitalSubmissionTimerProfiler
} from "./TakramOrbitalGpuProfiler";

interface RenderOwner {
  render: (...args: any[]) => any;
}

interface EffectPassLike extends RenderOwner {
  readonly camera: object;
  readonly effects: readonly object[];
  readonly name?: string;
  readonly scene: object;
}

interface CloudsEffectLike {
  readonly name?: string;
  readonly shadowPass: {
    readonly currentPass: RenderOwner;
    readonly resolvePass: RenderOwner;
  };
  readonly cloudsPass: {
    readonly currentPass: RenderOwner;
    readonly resolvePass: RenderOwner;
  };
}

interface ComposerLike {
  readonly passes: readonly object[];
}

export interface TakramOrbitalGpuSubmissionAudit {
  readonly combinedPassName: string;
  readonly effectOrder: readonly string[];
  readonly hookSourceFnv1a64: string;
  readonly installedBuildFnv1a64: string;
  readonly originalMethodFnv1a64: Readonly<Record<string, string>>;
  readonly wrappedMethodFnv1a64: Readonly<Record<string, string>>;
}

function hashFnv1a64(value: string): string {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `fnv1a-64:${hash.toString(16).padStart(16, "0")}`;
}

function functionHash(value: Function): string {
  return hashFnv1a64(Function.prototype.toString.call(value));
}

function objectName(value: object): string {
  const named = (value as { name?: unknown }).name;
  if (typeof named === "string" && named.length > 0) return named;
  return value.constructor?.name ?? "Object";
}

function isEffectPassLike(value: object): value is EffectPassLike {
  const candidate = value as Partial<EffectPassLike>;
  return Array.isArray(candidate.effects) &&
    typeof candidate.render === "function" &&
    candidate.scene !== undefined && candidate.camera !== undefined;
}

export function installTakramOrbitalGpuSubmissionInstrumentation(
  input: Readonly<{
    aerialPerspectiveEffect: object;
    cloudsEffect: object;
    composer: object;
    copyOnlySubmission?: () => void;
    profiler: TakramOrbitalSubmissionTimerProfiler;
  }>
): Readonly<{
  audit: TakramOrbitalGpuSubmissionAudit;
  restore(): void;
}> {
  const composer = input.composer as ComposerLike;
  if (!Array.isArray(composer.passes)) {
    throw new Error("Composer pass list is unavailable for GPU instrumentation");
  }
  const matching = composer.passes.filter((pass): pass is EffectPassLike =>
    typeof pass === "object" && pass !== null && isEffectPassLike(pass) &&
    pass.effects.length === 2 &&
    pass.effects[0] === input.cloudsEffect &&
    pass.effects[1] === input.aerialPerspectiveEffect
  );
  if (matching.length !== 1) {
    throw new Error(
      "Expected exactly one combined Clouds/AerialPerspective EffectPass; " +
      `found ${matching.length}`
    );
  }
  const combinedPass = matching[0]!;
  const cloudsEffect = input.cloudsEffect as CloudsEffectLike;
  const nativeOwners = {
    "bsm-current": cloudsEffect.shadowPass?.currentPass,
    "bsm-resolve": cloudsEffect.shadowPass?.resolvePass,
    "cloud-current": cloudsEffect.cloudsPass?.currentPass,
    "cloud-resolve": cloudsEffect.cloudsPass?.resolvePass
  } satisfies Record<Exclude<TakramOrbitalGpuStageName, "final-effect">,
    RenderOwner | undefined>;
  for (const [stage, owner] of Object.entries(nativeOwners)) {
    if (owner === undefined || typeof owner.render !== "function") {
      throw new Error(`Native GPU submission ${stage} is unavailable`);
    }
  }

  type FrameContext = {
    frameId: number;
    measure: boolean;
    totalStarted: boolean;
  };
  let frameContext: FrameContext | null = null;
  let restored = false;
  const originals = new Map<RenderOwner, RenderOwner["render"]>();
  const originalMethodFnv1a64: Record<string, string> = {};
  const wrappedMethodFnv1a64: Record<string, string> = {};

  function wrapNative(
    owner: RenderOwner,
    stage: Exclude<TakramOrbitalGpuStageName, "final-effect">
  ) {
    const original = owner.render;
    originals.set(owner, original);
    originalMethodFnv1a64[stage] = functionHash(original);
    owner.render = function wrappedNativeSubmission(this: unknown, ...args: any[]) {
      const context = frameContext;
      if (context === null || !context.measure) {
        return original.apply(this, args);
      }
      if (input.profiler.measurementMode === "total-only-time-elapsed") {
        if (stage === "bsm-current") {
          if (context.totalStarted) {
            throw new Error("GPU total query began more than once in one frame");
          }
          input.profiler.beginTotal(context.frameId);
          context.totalStarted = true;
        }
        return original.apply(this, args);
      }
      input.profiler.beginStage(context.frameId, stage);
      try {
        return original.apply(this, args);
      } finally {
        input.profiler.endStage(context.frameId, stage);
      }
    };
    wrappedMethodFnv1a64[stage] = functionHash(owner.render);
  }

  for (const [stage, owner] of Object.entries(nativeOwners) as Array<[
    Exclude<TakramOrbitalGpuStageName, "final-effect">,
    RenderOwner
  ]>) {
    wrapNative(owner, stage);
  }

  const originalCombinedRender = combinedPass.render;
  originals.set(combinedPass, originalCombinedRender);
  originalMethodFnv1a64["combined-effect-pass"] = functionHash(
    originalCombinedRender
  );
  combinedPass.render = function wrappedCombinedEffectPass(
    this: EffectPassLike,
    ...args: any[]
  ) {
    if (frameContext !== null) {
      throw new Error("Combined EffectPass GPU instrumentation is already active");
    }
    const renderer = args[0] as RenderOwner | undefined;
    if (renderer === undefined || typeof renderer.render !== "function") {
      throw new Error("Combined EffectPass renderer is unavailable");
    }
    const instruction = input.profiler.beginFrame();
    const context: FrameContext = {
      frameId: instruction.frameId,
      measure: instruction.measure,
      totalStarted: false
    };
    frameContext = context;
    const originalRendererRender = renderer.render;
    renderer.render = function instrumentedRendererDraw(
      this: unknown,
      scene: object,
      camera: object,
      ...renderArgs: any[]
    ) {
      if (!context.measure || input.profiler.measurementMode !==
        "stage-only-sequential-time-elapsed" ||
        scene !== combinedPass.scene || camera !== combinedPass.camera) {
        return originalRendererRender.call(this, scene, camera, ...renderArgs);
      }
      input.profiler.beginStage(context.frameId, "final-effect");
      try {
        return originalRendererRender.call(this, scene, camera, ...renderArgs);
      } finally {
        input.profiler.endStage(context.frameId, "final-effect");
      }
    };

    let result: unknown;
    let thrown: unknown;
    try {
      result = originalCombinedRender.apply(this, args);
    } catch (error) {
      thrown = error;
    }
    renderer.render = originalRendererRender;
    try {
      if (context.measure && input.profiler.measurementMode ===
          "total-only-time-elapsed") {
        if (!context.totalStarted) {
          throw new Error("GPU total query did not begin at BSM current");
        }
        input.profiler.endTotal(context.frameId);
      }
      input.profiler.finishFrame(context.frameId, input.copyOnlySubmission);
    } catch (cleanupError) {
      if (thrown === undefined) thrown = cleanupError;
    } finally {
      frameContext = null;
    }
    if (thrown !== undefined) throw thrown;
    return result;
  };
  wrappedMethodFnv1a64["combined-effect-pass"] = functionHash(
    combinedPass.render
  );

  const hookSource = [wrapNative, combinedPass.render].map((value) =>
    Function.prototype.toString.call(value)
  ).join("\n");
  const audit = Object.freeze({
    combinedPassName: objectName(combinedPass),
    effectOrder: Object.freeze(combinedPass.effects.map(objectName)),
    hookSourceFnv1a64: hashFnv1a64(hookSource),
    installedBuildFnv1a64: hashFnv1a64(JSON.stringify(originalMethodFnv1a64)),
    originalMethodFnv1a64: Object.freeze(originalMethodFnv1a64),
    wrappedMethodFnv1a64: Object.freeze(wrappedMethodFnv1a64)
  });

  return Object.freeze({
    audit,
    restore: () => {
      if (restored) return;
      restored = true;
      for (const [owner, original] of originals) owner.render = original;
      frameContext = null;
    }
  });
}
