import { Uniform } from "three";

export const TAKRAM_ALTITUDE_LADDER_SHADER_MODES = Object.freeze({
  normal: 0,
  density: 1,
  weather: 2,
  radiance: 3
});

type ShaderUniform = { value: unknown };

export interface TakramAltitudeLadderMaterial {
  fragmentShader: string;
  needsUpdate: boolean;
  uniforms: Record<string, ShaderUniform>;
  userData?: Record<string, unknown>;
}

const INSTALLATION_KEY = "miralithAltitudeLadderInstrumentation";

function replaceShaderFragment(
  shader: string,
  search: string,
  replacement: string,
  label: string
) {
  if (!shader.includes(search)) {
    throw new Error("Takram altitude ladder could not locate " + label + ".");
  }
  return shader.replace(search, replacement);
}

/**
 * Adds a capture-only probe to the resolved Takram shader.
 * Mode 0 keeps native output; mode 1 writes shell length, primary sample
 * count, max density and average participating-media density; mode 2 writes
 * the rough weather density; mode 3 writes the raw marchClouds result before
 * native cloud aerial perspective/haze. Takram's MediaSample does not expose
 * its intermediate density sum, so the probe records media.scattering; with
 * the frozen scatteringCoefficient=1 this is the native effective density
 * sum.
 *
 * This stays in the parity harness rather than the package patch: promotion
 * never enables the branch, and the native shader remains the render owner.
 */
export function installTakramAltitudeLadderInstrumentation(
  material: TakramAltitudeLadderMaterial
): void {
  if (material.userData?.[INSTALLATION_KEY] === true) {
    return;
  }

  let shader = material.fragmentShader;
  const requiredFragments = [
    "uniform float sceneDepthScale;",
    "out ivec3 sampleCount",
    "MediaSample media = sampleMedia(weather, position, uv, mipLevel, jitter, sampleCount);",
    "#ifdef DEBUG_SHOW_SAMPLE_COUNT",
    "// The final product of 5.9.1 and we'll evaluate this in aerial perspective."
  ];
  if (requiredFragments.some((fragment) => !shader.includes(fragment))) {
    throw new Error("Takram altitude ladder could not locate the pinned cloud shader contract.");
  }

  shader = replaceShaderFragment(
    shader,
    "uniform float sceneDepthScale;",
    "uniform float sceneDepthScale;\nuniform int altitudeLadderMode;",
    "scene depth uniform"
  );
  shader = replaceShaderFragment(
    shader,
    "  out float frontDepth,\n  out ivec3 sampleCount\n) {",
    "  out float frontDepth,\n  out ivec3 sampleCount,\n  out float ladderDensitySum,\n  out float ladderDensityMax,\n  out float ladderDensitySampleCount,\n  out float ladderPrimarySampleCount,\n  out float ladderWeatherSum,\n  out float ladderWeatherMax,\n  out float ladderWeatherSampleCount\n) {",
    "marchClouds output parameters"
  );
  shader = replaceShaderFragment(
    shader,
    "  out float ladderWeatherSampleCount",
    "  out float ladderWeatherSampleCount,\n  out float ladderRawTransmittance",
    "raw transmittance output parameter"
  );
  shader = replaceShaderFragment(
    shader,
    "  float transmittanceSum = 0.0;\n",
    "  float transmittanceSum = 0.0;\n  float ladderDensitySumLocal = 0.0;\n  float ladderDensityMaxLocal = 0.0;\n  float ladderDensitySampleCountLocal = 0.0;\n  float ladderPrimarySampleCountLocal = 0.0;\n  float ladderWeatherSumLocal = 0.0;\n  float ladderWeatherMaxLocal = 0.0;\n  float ladderWeatherSampleCountLocal = 0.0;\n",
    "marchClouds accumulators"
  );
  shader = replaceShaderFragment(
    shader,
    "    WeatherSample weather = sampleWeather(uv, height, mipLevel);\n\n    #ifdef DEBUG_SHOW_SAMPLE_COUNT\n",
    "    WeatherSample weather = sampleWeather(uv, height, mipLevel);\n    ladderPrimarySampleCountLocal += 1.0;\n    float weatherDensity = max(max(weather.density.x, weather.density.y), max(weather.density.z, weather.density.w));\n    ladderWeatherSumLocal += weatherDensity;\n    ladderWeatherMaxLocal = max(ladderWeatherMaxLocal, weatherDensity);\n    ladderWeatherSampleCountLocal += 1.0;\n\n    #ifdef DEBUG_SHOW_SAMPLE_COUNT\n",
    "weather sample"
  );
  shader = replaceShaderFragment(
    shader,
    "    MediaSample media = sampleMedia(weather, position, uv, mipLevel, jitter, sampleCount);",
    "    MediaSample media = sampleMedia(weather, position, uv, mipLevel, jitter, sampleCount);",
    "participating-media sample"
  );
  shader = replaceShaderFragment(
    shader,
    "    if (media.extinction > minExtinction) {\n",
    "    if (media.extinction > minExtinction) {\n      ladderDensitySumLocal += media.scattering;\n      ladderDensityMaxLocal = max(ladderDensityMaxLocal, media.scattering);\n      ladderDensitySampleCountLocal += 1.0;\n",
    "participating-media contribution"
  );
  shader = replaceShaderFragment(
    shader,
    "  // The final product of 5.9.1 and we'll evaluate this in aerial perspective.",
    "  ladderDensitySum = ladderDensitySumLocal;\n  ladderDensityMax = ladderDensityMaxLocal;\n  ladderDensitySampleCount = ladderDensitySampleCountLocal;\n  ladderPrimarySampleCount = ladderPrimarySampleCountLocal;\n  ladderWeatherSum = ladderWeatherSumLocal;\n  ladderWeatherMax = ladderWeatherMaxLocal;\n  ladderWeatherSampleCount = ladderWeatherSampleCountLocal;\n\n  // The final product of 5.9.1 and we'll evaluate this in aerial perspective.",
    "marchClouds output assignments"
  );
  shader = replaceShaderFragment(
    shader,
    "  ladderWeatherSampleCount = ladderWeatherSampleCountLocal;",
    "  ladderWeatherSampleCount = ladderWeatherSampleCountLocal;\n  ladderRawTransmittance = transmittanceIntegral;",
    "raw transmittance output assignment"
  );
  shader = replaceShaderFragment(
    shader,
    "    ivec3 sampleCount = ivec3(0);\n    color = marchClouds(",
    "    ivec3 sampleCount = ivec3(0);\n    float ladderDensitySum = 0.0;\n    float ladderDensityMax = 0.0;\n    float ladderDensitySampleCount = 0.0;\n    float ladderPrimarySampleCount = 0.0;\n    float ladderWeatherSum = 0.0;\n    float ladderWeatherMax = 0.0;\n    float ladderWeatherSampleCount = 0.0;\n    color = marchClouds(",
    "fragment probe accumulators"
  );
  shader = replaceShaderFragment(
    shader,
    "    float ladderWeatherSampleCount = 0.0;",
    "    float ladderWeatherSampleCount = 0.0;\n    float ladderRawTransmittance = 1.0;",
    "raw transmittance fragment accumulator"
  );
  shader = replaceShaderFragment(
    shader,
    "      marchedFrontDepth,\n      sampleCount\n    );",
    "      marchedFrontDepth,\n      sampleCount,\n      ladderDensitySum,\n      ladderDensityMax,\n      ladderDensitySampleCount,\n      ladderPrimarySampleCount,\n      ladderWeatherSum,\n      ladderWeatherMax,\n      ladderWeatherSampleCount\n    );",
    "marchClouds invocation"
  );
  shader = replaceShaderFragment(
    shader,
    "      ladderWeatherSampleCount\n    );",
    "      ladderWeatherSampleCount,\n      ladderRawTransmittance\n    );",
    "raw transmittance invocation"
  );

  const densityDebugOutput = [
    "    if (altitudeLadderMode == 1) {",
    "      float averageDensity = ladderDensitySampleCount > 0.0",
    "        ? ladderDensitySum / ladderDensitySampleCount",
    "        : 0.0;",
    "      outputColor = vec4(",
    "        clamp((rayNearFar.y - rayNearFar.x) / 1000000.0, 0.0, 1.0),",
    "        clamp(ladderPrimarySampleCount / 500.0, 0.0, 1.0),",
    "        clamp(ladderDensityMax, 0.0, 1.0),",
    "        clamp(averageDensity, 0.0, 1.0)",
    "      );",
    "      outputDepthVelocity = vec3(0.0);",
    "      #ifdef SHADOW_LENGTH",
    "      outputShadowLength = 0.0;",
    "      #endif // SHADOW_LENGTH",
    "      return;",
    "    }",
    "",
    "    if (altitudeLadderMode == 2) {",
    "      float averageWeather = ladderWeatherSampleCount > 0.0",
    "        ? ladderWeatherSum / ladderWeatherSampleCount",
    "        : 0.0;",
    "      outputColor = vec4(",
    "        clamp((rayNearFar.y - rayNearFar.x) / 1000000.0, 0.0, 1.0),",
    "        clamp(ladderPrimarySampleCount / 500.0, 0.0, 1.0),",
    "        clamp(ladderWeatherMax, 0.0, 1.0),",
    "        clamp(averageWeather, 0.0, 1.0)",
    "      );",
    "      outputDepthVelocity = vec3(0.0);",
    "      #ifdef SHADOW_LENGTH",
    "      outputShadowLength = 0.0;",
    "      #endif // SHADOW_LENGTH",
    "      return;",
    "    }",
    "",
    "    if (altitudeLadderMode == 3) {",
    "      outputColor = vec4(color.rgb, ladderRawTransmittance);",
    "      outputDepthVelocity = vec3(0.0);",
    "      #ifdef SHADOW_LENGTH",
    "      outputShadowLength = 0.0;",
    "      #endif // SHADOW_LENGTH",
    "      return;",
    "    }",
    "",
    "    #ifdef DEBUG_SHOW_SAMPLE_COUNT"
  ].join("\n");
  shader = replaceShaderFragment(
    shader,
    "      ladderRawTransmittance\n    );\n\n    #ifdef DEBUG_SHOW_SAMPLE_COUNT\n",
    "      ladderRawTransmittance\n    );\n\n" + densityDebugOutput + "\n",
    "density debug output"
  );

  material.fragmentShader = shader;
  material.uniforms.altitudeLadderMode = new Uniform(
    TAKRAM_ALTITUDE_LADDER_SHADER_MODES.normal
  );
  material.userData ??= {};
  material.userData[INSTALLATION_KEY] = true;
  material.needsUpdate = true;
}

export function setTakramAltitudeLadderShaderMode(
  material: TakramAltitudeLadderMaterial,
  mode: number
) {
  const uniform = material.uniforms.altitudeLadderMode;
  if (!uniform) {
    throw new Error("Takram altitude ladder instrumentation is not installed.");
  }
  uniform.value = mode;
}
