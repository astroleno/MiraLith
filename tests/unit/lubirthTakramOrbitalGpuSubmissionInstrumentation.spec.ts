import { expect, test } from "@playwright/test";

const modulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuSubmissionInstrumentation";

type Mode =
  | "total-only-time-elapsed"
  | "stage-only-sequential-time-elapsed";

function createFixture(mode: Mode) {
  const events: string[] = [];
  const renderer = {
    render(scene: object, camera: object) {
      if (scene === combined.scene && camera === combined.camera) {
        events.push("combined-final-render");
      } else {
        events.push("unrelated-renderer-draw");
      }
    }
  };
  const pass = (name: string) => ({
    render() { events.push(name); }
  });
  const cloudsEffect = {
    name: "CloudsEffect",
    shadowPass: {
      currentPass: pass("bsm-current"),
      resolvePass: pass("bsm-resolve")
    },
    cloudsPass: {
      currentPass: pass("cloud-current"),
      resolvePass: pass("cloud-resolve")
    },
    update(renderDriver: typeof renderer) {
      this.shadowPass.currentPass.render(renderDriver);
      this.shadowPass.resolvePass.render(renderDriver);
      this.cloudsPass.currentPass.render(renderDriver);
      this.cloudsPass.resolvePass.render(renderDriver);
    }
  };
  const aerialPerspectiveEffect = {
    name: "AerialPerspectiveEffect",
    update() {}
  };
  const combined = {
    name: "EffectPass",
    effects: [cloudsEffect, aerialPerspectiveEffect],
    scene: {},
    camera: {},
    render(renderDriver: typeof renderer) {
      cloudsEffect.update(renderDriver);
      aerialPerspectiveEffect.update();
      renderDriver.render(this.scene, this.camera);
    }
  };
  const unrelated = {
    name: "RenderPass",
    render() { events.push("unrelated-render-pass"); }
  };
  let frameId = 0;
  const profiler = {
    beginFrame() { return { frameId: ++frameId, measure: true }; },
    beginTotal() { events.push("begin-total"); },
    endTotal() { events.push("end-total"); },
    beginStage(_frameId: number, stage: string) {
      events.push(`begin-${stage}`);
    },
    endStage(_frameId: number, stage: string) {
      events.push(`end-${stage}`);
    },
    finishFrame() {},
    measurementMode: mode,
    snapshot() { return { measurementMode: mode }; }
  };
  return {
    aerialPerspectiveEffect,
    cloudsEffect,
    combined,
    composer: { passes: [unrelated, combined] },
    events,
    profiler,
    renderer,
    unrelated
  };
}

test("times the exact total interval without RenderPass or NormalPass", async () => {
  const { installTakramOrbitalGpuSubmissionInstrumentation } = await import(
    modulePath
  );
  const fixture = createFixture("total-only-time-elapsed");
  const originalCombinedRender = fixture.combined.render;
  const installation = installTakramOrbitalGpuSubmissionInstrumentation({
    aerialPerspectiveEffect: fixture.aerialPerspectiveEffect,
    cloudsEffect: fixture.cloudsEffect,
    composer: fixture.composer,
    profiler: fixture.profiler as any
  });
  fixture.unrelated.render();
  fixture.combined.render(fixture.renderer);
  expect(fixture.events).toEqual([
    "unrelated-render-pass",
    "begin-total",
    "bsm-current",
    "bsm-resolve",
    "cloud-current",
    "cloud-resolve",
    "combined-final-render",
    "end-total"
  ]);
  expect(installation.audit.effectOrder).toEqual([
    "CloudsEffect",
    "AerialPerspectiveEffect"
  ]);
  expect(installation.audit.hookSourceFnv1a64).toMatch(
    /^fnv1a-64:[0-9a-f]{16}$/
  );
  installation.restore();
  expect(fixture.combined.render).toBe(originalCombinedRender);
});

test("times five non-nested stage submissions and only the combined draw", async () => {
  const { installTakramOrbitalGpuSubmissionInstrumentation } = await import(
    modulePath
  );
  const fixture = createFixture("stage-only-sequential-time-elapsed");
  const installation = installTakramOrbitalGpuSubmissionInstrumentation({
    aerialPerspectiveEffect: fixture.aerialPerspectiveEffect,
    cloudsEffect: fixture.cloudsEffect,
    composer: fixture.composer,
    profiler: fixture.profiler as any
  });
  fixture.combined.render(fixture.renderer);
  expect(fixture.events).toEqual([
    "begin-bsm-current", "bsm-current", "end-bsm-current",
    "begin-bsm-resolve", "bsm-resolve", "end-bsm-resolve",
    "begin-cloud-current", "cloud-current", "end-cloud-current",
    "begin-cloud-resolve", "cloud-resolve", "end-cloud-resolve",
    "begin-final-effect", "combined-final-render", "end-final-effect"
  ]);
  installation.restore();
});

test("rejects combined-pass drift and restores finally cleanup on exceptions", async () => {
  const { installTakramOrbitalGpuSubmissionInstrumentation } = await import(
    modulePath
  );
  const missing = createFixture("total-only-time-elapsed");
  expect(() => installTakramOrbitalGpuSubmissionInstrumentation({
    aerialPerspectiveEffect: missing.aerialPerspectiveEffect,
    cloudsEffect: missing.cloudsEffect,
    composer: { passes: [] },
    profiler: missing.profiler as any
  })).toThrow("Expected exactly one combined Clouds/AerialPerspective EffectPass; found 0");

  const wrongOrder = createFixture("total-only-time-elapsed");
  wrongOrder.combined.effects.reverse();
  expect(() => installTakramOrbitalGpuSubmissionInstrumentation({
    aerialPerspectiveEffect: wrongOrder.aerialPerspectiveEffect,
    cloudsEffect: wrongOrder.cloudsEffect,
    composer: wrongOrder.composer,
    profiler: wrongOrder.profiler as any
  })).toThrow("Expected exactly one combined Clouds/AerialPerspective EffectPass; found 0");

  const fixture = createFixture("stage-only-sequential-time-elapsed");
  fixture.cloudsEffect.cloudsPass.currentPass.render = () => {
    fixture.events.push("cloud-current-throws");
    throw new Error("boom");
  };
  const originalRendererRender = fixture.renderer.render;
  const installation = installTakramOrbitalGpuSubmissionInstrumentation({
    aerialPerspectiveEffect: fixture.aerialPerspectiveEffect,
    cloudsEffect: fixture.cloudsEffect,
    composer: fixture.composer,
    profiler: fixture.profiler as any
  });
  expect(() => fixture.combined.render(fixture.renderer)).toThrow("boom");
  expect(fixture.events).toContain("end-cloud-current");
  expect(fixture.renderer.render).toBe(originalRendererRender);
  installation.restore();
});
