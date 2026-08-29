import { expect, test } from "@playwright/test";
import {
  BASELINE_VOLUMETRIC_EARTH_CLOUD_TUNING,
  FBM_VOLUMETRIC_EARTH_CLOUD_TUNING,
  resolveVolumetricEarthCloudLook,
  resolveVolumetricEarthCloudTuning
} from "../../apps/site/components/volumetricEarthCloudLook";

test("volumetric Earth cloud look defaults to the unchanged baseline", () => {
  expect(resolveVolumetricEarthCloudLook(undefined)).toBe("baseline");
  expect(resolveVolumetricEarthCloudLook("unknown")).toBe("baseline");
  expect(resolveVolumetricEarthCloudTuning("baseline")).toEqual(
    BASELINE_VOLUMETRIC_EARTH_CLOUD_TUNING
  );
  expect(BASELINE_VOLUMETRIC_EARTH_CLOUD_TUNING).toEqual({
    detailStrength: 0,
    detailOctaves: 0,
    detailScale: 7.5,
    absorptionCoefficient: 4.8,
    phaseAnisotropy: 0.42,
    forwardScatterStrength: 0.11,
    silverPower: 4,
    silverStrength: 0.26
  });
});

test("FBM cloud look is an explicit A/B variant", () => {
  expect(resolveVolumetricEarthCloudLook("fbm")).toBe("fbm");
  expect(resolveVolumetricEarthCloudTuning("fbm")).toEqual(
    FBM_VOLUMETRIC_EARTH_CLOUD_TUNING
  );
  expect(FBM_VOLUMETRIC_EARTH_CLOUD_TUNING.detailStrength).toBeGreaterThan(0);
  expect(FBM_VOLUMETRIC_EARTH_CLOUD_TUNING.detailOctaves).toBe(4);
  expect(FBM_VOLUMETRIC_EARTH_CLOUD_TUNING.phaseAnisotropy).toBeGreaterThan(
    BASELINE_VOLUMETRIC_EARTH_CLOUD_TUNING.phaseAnisotropy
  );
});

test("cloud look tuning keeps optical controls inside the bounded experiment range", () => {
  for (const tuning of [
    BASELINE_VOLUMETRIC_EARTH_CLOUD_TUNING,
    FBM_VOLUMETRIC_EARTH_CLOUD_TUNING
  ]) {
    expect(tuning.absorptionCoefficient).toBeGreaterThan(0);
    expect(tuning.absorptionCoefficient).toBeLessThanOrEqual(8);
    expect(tuning.phaseAnisotropy).toBeGreaterThanOrEqual(0);
    expect(tuning.phaseAnisotropy).toBeLessThan(1);
    expect(tuning.silverPower).toBeGreaterThan(0);
    expect(tuning.silverStrength).toBeGreaterThanOrEqual(0);
    expect(tuning.silverStrength).toBeLessThanOrEqual(1);
    expect(tuning.detailStrength).toBeGreaterThanOrEqual(0);
    expect(tuning.detailStrength).toBeLessThanOrEqual(0.35);
  }
});
