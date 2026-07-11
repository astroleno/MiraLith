import { expect, test } from "@playwright/test";
import { resolveRadioGagaParticleBudget } from "../../packages/radio-gaga-scene/src/radioGagaParticleBudget";
import { createRadioGagaParticleTargets } from "../../packages/radio-gaga-scene/src/radioGagaParticleTargets";

test("particle budget is bounded and reduced motion is static", () => {
  expect(resolveRadioGagaParticleBudget("high", false).count).toBeLessThanOrEqual(9000);
  expect(resolveRadioGagaParticleBudget("medium", false).count).toBeLessThanOrEqual(5600);
  expect(resolveRadioGagaParticleBudget("low", false).count).toBeLessThanOrEqual(2600);
  expect(resolveRadioGagaParticleBudget("fallback", false).count).toBe(0);
  expect(resolveRadioGagaParticleBudget("high", true).count).toBe(0);
});

test("particle targets are deterministic for the same seed", () => {
  const input = {
    count: 4,
    seed: 73,
    radioSurface: new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]),
    esp32Surface: new Float32Array([-0.5, -0.5, 0, 0.5, 0.5, 0]),
    proofOnePixels: new Uint8ClampedArray([255, 220, 180, 255, 10, 20, 30, 255]),
    proofTwoPixels: new Uint8ClampedArray([40, 80, 120, 255, 230, 240, 250, 255])
  };

  const first = createRadioGagaParticleTargets(input);
  const second = createRadioGagaParticleTargets(input);

  expect(Array.from(first.radio)).toEqual(Array.from(second.radio));
  expect(Array.from(first.proofOne)).toEqual(Array.from(second.proofOne));
  expect(Array.from(first.proofTwo)).toEqual(Array.from(second.proofTwo));
  expect(Array.from(first.esp32)).toEqual(Array.from(second.esp32));
  expect(Array.from(first.home)).toEqual(Array.from(second.home));
  expect(first.radio).toHaveLength(input.count * 3);
});

test("standalone Radio Gaga is a local case study, not a live product runtime", async ({ page }) => {
  const remoteRuntimeRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin !== "http://127.0.0.1:3100" ||
      /api|listenhub|publish|mcp|worker|audio/i.test(url.pathname)
    ) {
      remoteRuntimeRequests.push(request.url());
    }
  });

  await page.goto("/radio-gaga");
  await expect(page.locator('[data-radio-gaga-host="standalone"]')).toBeVisible();
  await expect(page.getByText("把附近发生的事，变成家里听得懂的一句提醒", { exact: true })).toBeVisible();
  expect(remoteRuntimeRequests).toEqual([]);
});
