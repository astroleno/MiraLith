import { Uniform } from "three";

type ShaderUniform = { value: unknown };

export interface TakramMipDiagnosticMaterial {
  fragmentShader: string;
  needsUpdate: boolean;
  uniforms: Record<string, ShaderUniform>;
  userData?: Record<string, unknown>;
}

const INSTALLATION_KEY = "miralithMipDiagnosticInstrumentation";

export function hashTakramMipDiagnosticShader(shader: string) {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(shader)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `fnv1a-64:${hash.toString(16).padStart(16, "0")}`;
}

export function readTakramMipDiagnosticShaderIdentity(
  material: TakramMipDiagnosticMaterial
) {
  return hashTakramMipDiagnosticShader(material.fragmentShader);
}

function replaceOnce(shader: string, search: string, replacement: string, label: string) {
  const first = shader.indexOf(search);
  if (first < 0 || shader.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Takram mip diagnostic could not locate unique ${label}.`);
  }
  return shader.replace(search, replacement);
}

/**
 * Adds a capture-only per-primary-sample probe. The native mip expression is
 * deliberately left byte-for-byte intact: this module reads its inputs and
 * output but never introduces mipDistanceScale or changes the coefficient.
 */
export function installTakramMipDiagnosticInstrumentation(
  material: TakramMipDiagnosticMaterial
) {
  if (material.userData?.[INSTALLATION_KEY] === true) {
    throw new Error("Takram mip diagnostic instrumentation is already installed.");
  }
  const originalShader = material.fragmentShader;
  let shader = originalShader;

  shader = replaceOnce(
    shader,
    "uniform float sceneDepthScale;",
    [
      "uniform float sceneDepthScale;",
      "uniform int mipDiagnosticMode;",
      "uniform int mipDiagnosticSampleOrdinal;",
      "float mipDiagnosticRayDistanceKilometers = 0.0;",
      "float mipDiagnosticRayStartTexelsPerPixel = 0.0;",
      "float mipDiagnosticActualMip = 0.0;",
      "float mipDiagnosticWeatherDensity = 0.0;",
      "float mipDiagnosticValid = 0.0;",
      "float mipDiagnosticWeatherHit = 0.0;",
      "float mipDiagnosticPrimaryHit = 0.0;",
      "float mipDiagnosticRawTransmittance = 1.0;",
      "int mipDiagnosticPrimarySampleCounter = 0;"
    ].join("\n"),
    "scene-depth uniform"
  );
  shader = replaceOnce(
    shader,
    "    // Sample rough weather.\n    vec2 uv = getGlobeUv(position);\n    WeatherSample weather = sampleWeather(uv, height, mipLevel);",
    [
      "    // Sample rough weather.",
      "    vec2 uv = getGlobeUv(position);",
      "    int mipDiagnosticCurrentOrdinal = mipDiagnosticPrimarySampleCounter;",
      "    mipDiagnosticPrimarySampleCounter += 1;",
      "    WeatherSample weather = sampleWeather(uv, height, mipLevel);",
      "    if (mipDiagnosticMode == 1 && mipDiagnosticCurrentOrdinal == mipDiagnosticSampleOrdinal) {",
      "      float weatherDensity = max(max(weather.density.x, weather.density.y), max(weather.density.z, weather.density.w));",
      "      mipDiagnosticRayDistanceKilometers = rayDistance * 0.001;",
      "      mipDiagnosticRayStartTexelsPerPixel = rayStartTexelsPerPixel;",
      "      mipDiagnosticActualMip = mipLevel;",
      "      mipDiagnosticWeatherDensity = weatherDensity;",
      "      mipDiagnosticValid = 1.0;",
      "      mipDiagnosticWeatherHit = any(greaterThan(weather.density, vec4(minDensity))) ? 1.0 : 0.0;",
      "    }"
    ].join("\n"),
    "rough-weather sample"
  );
  shader = replaceOnce(
    shader,
    "    if (media.extinction > minExtinction) {",
    [
      "    if (media.extinction > minExtinction) {",
      "      if (mipDiagnosticMode == 1 && mipDiagnosticCurrentOrdinal == mipDiagnosticSampleOrdinal) {",
      "        mipDiagnosticPrimaryHit = 1.0;",
      "      }"
    ].join("\n"),
    "primary media hit"
  );
  shader = replaceOnce(
    shader,
    "  // The final product of 5.9.1 and we'll evaluate this in aerial perspective.",
    [
      "  mipDiagnosticRawTransmittance = transmittanceIntegral;",
      "",
      "  // The final product of 5.9.1 and we'll evaluate this in aerial perspective."
    ].join("\n"),
    "raw transmittance assignment"
  );
  shader = replaceOnce(
    shader,
    "  }\n\n  if (!hitClouds) {",
    [
      "  }",
      "",
      "  if (mipDiagnosticMode == 1) {",
      "    outputColor = vec4(",
      "      mipDiagnosticRayDistanceKilometers,",
      "      mipDiagnosticRayStartTexelsPerPixel,",
      "      mipDiagnosticActualMip,",
      "      mipDiagnosticWeatherDensity",
      "    );",
      "    outputDepthVelocity = vec3(mipDiagnosticValid, mipDiagnosticWeatherHit, mipDiagnosticPrimaryHit);",
      "    #ifdef SHADOW_LENGTH",
      "    outputShadowLength = 1.0 - mipDiagnosticRawTransmittance;",
      "    #endif // SHADOW_LENGTH",
      "    return;",
      "  }",
      "",
      "  if (!hitClouds) {"
    ].join("\n"),
    "diagnostic MRT output"
  );

  material.fragmentShader = shader;
  material.uniforms.mipDiagnosticMode = new Uniform(0);
  material.uniforms.mipDiagnosticSampleOrdinal = new Uniform(0);
  material.userData ??= {};
  material.userData[INSTALLATION_KEY] = true;
  material.needsUpdate = true;

  return () => {
    material.fragmentShader = originalShader;
    delete material.uniforms.mipDiagnosticMode;
    delete material.uniforms.mipDiagnosticSampleOrdinal;
    if (material.userData) delete material.userData[INSTALLATION_KEY];
    material.needsUpdate = true;
  };
}

export function configureTakramMipDiagnosticSample(
  material: TakramMipDiagnosticMaterial,
  sampleOrdinal: number
) {
  const mode = material.uniforms.mipDiagnosticMode;
  const ordinal = material.uniforms.mipDiagnosticSampleOrdinal;
  if (!mode || !ordinal || !Number.isInteger(sampleOrdinal) || sampleOrdinal < 0) {
    throw new Error("Takram mip diagnostic instrumentation is not configured.");
  }
  mode.value = 1;
  ordinal.value = sampleOrdinal;
}

export function disableTakramMipDiagnosticSample(material: TakramMipDiagnosticMaterial) {
  const mode = material.uniforms.mipDiagnosticMode;
  if (!mode) {
    throw new Error("Takram mip diagnostic instrumentation is not installed.");
  }
  mode.value = 0;
}
