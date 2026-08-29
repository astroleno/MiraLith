export type VolumetricEarthCloudLook = "baseline" | "fbm";

export interface VolumetricEarthCloudTuning {
  detailStrength: number;
  detailOctaves: number;
  detailScale: number;
  absorptionCoefficient: number;
  phaseAnisotropy: number;
  forwardScatterStrength: number;
  silverPower: number;
  silverStrength: number;
}

export const BASELINE_VOLUMETRIC_EARTH_CLOUD_TUNING = Object.freeze<VolumetricEarthCloudTuning>({
  detailStrength: 0,
  detailOctaves: 0,
  detailScale: 7.5,
  absorptionCoefficient: 4.8,
  phaseAnisotropy: 0.42,
  forwardScatterStrength: 0.11,
  silverPower: 4,
  silverStrength: 0.26
});

export const FBM_VOLUMETRIC_EARTH_CLOUD_TUNING = Object.freeze<VolumetricEarthCloudTuning>({
  detailStrength: 0.14,
  detailOctaves: 4,
  detailScale: 7.5,
  absorptionCoefficient: 5.2,
  phaseAnisotropy: 0.5,
  forwardScatterStrength: 0.14,
  silverPower: 3.5,
  silverStrength: 0.34
});

export function resolveVolumetricEarthCloudLook(value: string | null | undefined): VolumetricEarthCloudLook {
  return value === "fbm" ? "fbm" : "baseline";
}

export function resolveVolumetricEarthCloudTuning(
  look: VolumetricEarthCloudLook
): VolumetricEarthCloudTuning {
  return look === "fbm"
    ? FBM_VOLUMETRIC_EARTH_CLOUD_TUNING
    : BASELINE_VOLUMETRIC_EARTH_CLOUD_TUNING;
}
