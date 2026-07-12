export const coScrollSourceCausticFragmentShader = `
varying vec2 vUv;

uniform float uAnchorPresence;
uniform float uAspect;
uniform float uChromaOffset;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uFieldRotation;
uniform float uIntensity;
uniform float uIsMobile;
uniform vec4 uLyricCenters;
uniform float uMotionEnergy;
uniform float uPulseStrength;
uniform float uTime;
uniform float uWarpAmount;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 gradient2(vec2 p) {
  float angle = hash21(p) * 6.28318530718;
  return vec2(cos(angle), sin(angle));
}

float gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float a = dot(gradient2(i), f);
  float b = dot(gradient2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(gradient2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(gradient2(i + vec2(1.0)), f - vec2(1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 0.5 + 0.5;
}

float fbm3(vec2 p) {
  float value = 0.0;
  float amplitude = 0.55;

  for (int octave = 0; octave < 3; octave++) {
    value += gradientNoise(p) * amplitude;
    p = mat2(1.62, -1.18, 1.18, 1.62) * p + vec2(0.17, -0.11);
    amplitude *= 0.5;
  }

  return value;
}

mat2 rotate2(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float lyricColumn(vec2 centered, float center, float width) {
  float horizontal =
    1.0 - smoothstep(width, width * 2.25, abs(centered.x - center));
  float vertical = 1.0 - smoothstep(0.58, 1.06, abs(centered.y));
  return horizontal * vertical;
}

float ridgeField(vec2 p, float time, float organicPhase) {
  float primaryPhase =
    p.x * 4.1 +
    sin(p.y * 1.6 + time * 0.13) * 1.2 +
    sin((p.x + p.y) * 0.8 - time * 0.09) * 0.5 +
    organicPhase * 5.4 +
    time * 0.46;
  float secondaryPhase =
    p.y * 3.0 +
    cos(p.x * 1.4 - time * 0.15) * 1.0 -
    organicPhase * 3.8 -
    time * 0.32;
  float ridgeA = pow(
    1.0 - abs(sin(primaryPhase)),
    8.0
  );
  float ridgeB = pow(
    1.0 - abs(sin(secondaryPhase)),
    9.0
  );
  return clamp(
    ridgeA * 0.76 + ridgeB * 0.22 + ridgeA * ridgeB * 0.18,
    0.0,
    1.0
  );
}

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  vec2 aspectUv = vec2(centered.x * uAspect, centered.y);

  float readingChannel = 0.0;
  readingChannel = max(
    readingChannel,
    lyricColumn(centered, uLyricCenters.x, 0.034)
  );
  readingChannel = max(
    readingChannel,
    lyricColumn(centered, uLyricCenters.y, 0.034)
  );
  readingChannel = max(
    readingChannel,
    lyricColumn(centered, uLyricCenters.z, 0.038)
  );
  readingChannel = max(
    readingChannel,
    lyricColumn(centered, uLyricCenters.w, 0.034)
  );

  vec2 field = rotate2(uFieldRotation - 0.14) * aspectUv * 0.96;
  field += vec2(uTime * 0.055, -uTime * 0.042);

  float warpX = fbm3(field * 0.64 + vec2(uTime * 0.032, -uTime * 0.024));
  float warpY = fbm3(field * 0.73 + vec2(-uTime * 0.027, uTime * 0.035));
  vec2 warped =
    field + (vec2(warpX, warpY) - 0.5) * uWarpAmount;

  float broadNoise = fbm3(
    warped * 0.62 + vec2(uTime * 0.018, -uTime * 0.014)
  );

  float broadPhase =
    warped.x * 1.25 +
    warped.y * 1.15 +
    sin(warped.y * 2.05 + broadNoise * 2.4 + uTime * 0.16) * 0.72 +
    broadNoise * 2.0;

  float broadBand = 0.5 + 0.5 * sin(broadPhase);
  float counterFlow =
    0.5 +
    0.5 * cos(
      broadPhase * 0.52 +
      warped.x * 0.46 -
      warped.y * 0.72 +
      broadNoise * 0.65
    );
  float broadFlow = smoothstep(
    mix(0.68, 0.695, uIsMobile),
    mix(0.93, 0.94, uIsMobile),
    broadBand * 0.62 + counterFlow * 0.16 + broadNoise * 0.22
  );

  float pulseCycle =
    0.5 + 0.5 * sin(uTime * 0.68 + broadNoise * 4.2);

  float pulseGate = smoothstep(0.28, 0.88, pulseCycle);
  float pulseStreak = pow(
    1.0 - abs(sin(broadPhase * 2.2 - uTime * 0.24)),
    6.0
  );
  pulseStreak *= pulseGate * uPulseStrength;

  float mobileChromaScale = mix(1.0, 0.72, uIsMobile);
  float chroma = uChromaOffset * mobileChromaScale;

  vec2 microField = warped * mix(1.38, 1.24, uIsMobile);
  microField += vec2(
    sin(warped.y * 1.7 + broadNoise * 3.6),
    cos(warped.x * 1.5 - broadNoise * 3.2)
  ) * 0.24;
  float ridgeR = ridgeField(
    microField - vec2(chroma, 0.0),
    uTime,
    broadNoise
  );
  float ridgeG = ridgeField(microField, uTime, broadNoise);
  float ridgeB = ridgeField(
    microField + vec2(chroma, 0.0),
    uTime,
    broadNoise
  );
  vec3 spectralRidge = vec3(ridgeR, ridgeG, ridgeB);

  float microCaustic =
    dot(spectralRidge, vec3(0.2126, 0.7152, 0.0722));
  microCaustic *= mix(0.16, 0.24, uMotionEnergy);

  float wideEnvelope =
    1.0 - smoothstep(
      0.52,
      mix(1.58, 1.28, uIsMobile),
      length(vec2(centered.x * uAspect * 0.58, centered.y * 0.8))
    );

  float coverage = max(0.18, wideEnvelope);
  float readingSuppression = mix(1.0, 0.9, readingChannel * readingChannel);

  float lightSignal =
    broadFlow * 0.44 +
    pulseStreak * 0.56 +
    microCaustic * 0.34;

  float broadAlpha = smoothstep(0.58, 0.88, broadFlow) * 0.34;
  float pulseAlpha = smoothstep(0.04, 0.18, pulseStreak) * 0.28;
  float microAlpha = smoothstep(0.03, 0.16, microCaustic) * 0.2;
  float alphaSignal = broadAlpha + pulseAlpha + microAlpha;
  alphaSignal = min(
    1.0,
    alphaSignal * mix(1.75, 2.2, uIsMobile)
  );

  float alpha =
    alphaSignal *
    coverage *
    readingSuppression *
    uIntensity *
    uAnchorPresence;

  float highlightSignal = max(
    smoothstep(0.48, 0.94, broadFlow) * 0.88,
    max(
      smoothstep(0.03, 0.18, pulseStreak) * 0.82,
      smoothstep(0.025, 0.16, microCaustic) * 0.58
    )
  );

  vec3 color = mix(
    uColorA * 0.5,
    uColorB,
    smoothstep(0.06, 0.78, highlightSignal)
  );

  float spectralMono =
    dot(spectralRidge, vec3(0.2126, 0.7152, 0.0722));
  vec3 spectralDelta = spectralRidge - vec3(spectralMono);
  color = max(
    vec3(0.0),
    color + spectralDelta * 0.14 * uPulseStrength
  );

  gl_FragColor = vec4(color, alpha);
}
`;
