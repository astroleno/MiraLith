export const coScrollSourceCausticFragmentShader = `
varying vec2 vUv;

uniform float uAnchorPresence;
uniform vec2 uAnchorCenter;
uniform vec2 uAnchorFieldScale;
uniform float uAnchorFacing;
uniform float uAspect;
uniform float uChromaOffset;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uFieldRotation;
uniform float uIntensity;
uniform float uIsMobile;
uniform vec4 uLyricCenters;
uniform float uLensStrength;
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

float capsuleSdf(vec2 p, vec2 a, vec2 b, float radius) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - radius;
}

float smoothUnion(float a, float b, float softness) {
  float h = clamp(0.5 + 0.5 * (b - a) / softness, 0.0, 1.0);
  return mix(b, a, h) - softness * h * (1.0 - h);
}

vec2 sourceAnchorLocalPoint(
  vec2 p,
  float facing,
  float projectionFloor
) {
  float projection = mix(
    projectionFloor,
    1.0,
    smoothstep(0.0, 0.92, abs(facing))
  );
  p.x /= projection;
  p.x *= facing < 0.0 ? -1.0 : 1.0;
  return p;
}

float sourceAnchorStrokeSdf(vec2 p, float facing) {
  p = sourceAnchorLocalPoint(p, facing, 0.24);

  float distanceField = capsuleSdf(
    p,
    vec2(0.27, 0.78),
    vec2(0.25, -0.18),
    0.13
  );
  distanceField = smoothUnion(
    distanceField,
    capsuleSdf(p, vec2(-0.02, 0.58), vec2(-0.07, -0.6), 0.12),
    0.11
  );
  distanceField = smoothUnion(
    distanceField,
    capsuleSdf(p, vec2(-0.39, 0.34), vec2(-0.08, 0.04), 0.13),
    0.12
  );
  distanceField = smoothUnion(
    distanceField,
    capsuleSdf(p, vec2(-0.42, -0.04), vec2(-0.08, -0.25), 0.13),
    0.11
  );
  distanceField = smoothUnion(
    distanceField,
    capsuleSdf(p, vec2(-0.06, -0.58), vec2(0.34, -0.56), 0.12),
    0.1
  );
  distanceField = smoothUnion(
    distanceField,
    capsuleSdf(p, vec2(0.34, -0.56), vec2(0.43, -0.28), 0.11),
    0.09
  );
  return distanceField;
}

float sourceAnchorHullSdf(vec2 p, float facing) {
  p = sourceAnchorLocalPoint(p, facing, 0.48);

  float distanceField = capsuleSdf(
    p,
    vec2(0.15, 0.72),
    vec2(0.11, -0.43),
    0.32
  );
  distanceField = smoothUnion(
    distanceField,
    capsuleSdf(p, vec2(-0.34, 0.34), vec2(0.08, -0.17), 0.3),
    0.22
  );
  distanceField = smoothUnion(
    distanceField,
    capsuleSdf(p, vec2(-0.12, -0.49), vec2(0.35, -0.43), 0.29),
    0.2
  );
  return distanceField;
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

float iterativeCorona(vec2 p, float time, float phase) {
  vec2 q = p * 0.72;
  vec2 accumulation = vec2(0.0);
  float totalWeight = 0.0;

  for (int layer = 0; layer < 6; layer++) {
    float index = float(layer) + 1.0;
    float weight = 1.0 / (index + 0.65);
    vec2 drift = vec2(
      sin(q.y * (1.08 + index * 0.11) + time * (0.2 + index * 0.025) + phase),
      cos(q.x * (1.02 + index * 0.09) - time * (0.17 + index * 0.021) - phase)
    );
    q += drift * weight * 0.34;
    q = rotate2(0.16 + index * 0.041) * q + vec2(0.14, -0.1);
    accumulation += vec2(
      sin(q.x * 1.24 + index * 1.31),
      cos(q.y * 1.16 - index * 1.07)
    ) * weight;
    totalWeight += weight;
  }

  float cancellation = 1.0 - clamp(
    length(accumulation) / max(totalWeight, 0.0001),
    0.0,
    1.0
  );
  float crossFlow =
    0.5 +
    0.5 * sin(
      q.x * 1.14 +
      q.y * 0.86 +
      accumulation.x * 0.72 -
      accumulation.y * 0.48 +
      time * 0.22
    );
  return smoothstep(0.18, 0.82, cancellation * 0.7 + crossFlow * 0.3);
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

  vec2 anchorScale = max(uAnchorFieldScale, vec2(0.08));
  vec2 anchorPoint = (aspectUv - uAnchorCenter) / anchorScale;
  float hullDistance = sourceAnchorHullSdf(anchorPoint, uAnchorFacing);
  float strokeDistance = sourceAnchorStrokeSdf(anchorPoint, uAnchorFacing);
  vec2 hullNormal = normalize(
    vec2(dFdx(hullDistance), dFdy(hullDistance)) + vec2(0.0001)
  );
  vec2 strokeNormal = normalize(
    vec2(dFdx(strokeDistance), dFdy(strokeDistance)) + vec2(0.0001)
  );
  float strokeProximity =
    1.0 - smoothstep(0.08, 0.68, abs(strokeDistance));
  float strokeFieldReach =
    1.0 - smoothstep(0.36, 1.12, max(hullDistance, 0.0));
  float strokeInfluence =
    strokeProximity *
    strokeFieldReach *
    mix(0.32, 0.24, uIsMobile);
  vec2 flowNormal = normalize(
    mix(hullNormal, strokeNormal, strokeInfluence) + vec2(0.0001)
  );
  vec2 flowTangent = vec2(-flowNormal.y, flowNormal.x);
  vec2 strokeTangent = vec2(-strokeNormal.y, strokeNormal.x);
  float lensEnvelope =
    1.0 - smoothstep(0.02, 1.52, max(hullDistance, 0.0));
  float anchorExterior = smoothstep(-0.11, 0.14, hullDistance);
  float anchorRim =
    exp(-max(hullDistance, 0.0) * 2.85) *
    anchorExterior;
  float coronaSideBias = mix(
    0.08,
    1.0,
    smoothstep(0.16, 0.82, abs(hullNormal.x))
  );
  float coronaOpenDirection = clamp(
    uAnchorFacing * 1.4 +
      sin(uTime * 0.19 + uFieldRotation) * 0.35,
    -1.0,
    1.0
  );
  float coronaOpenBias = mix(
    0.08,
    1.0,
    smoothstep(
      -0.34,
      0.48,
      hullNormal.x * coronaOpenDirection +
        sin(anchorPoint.y * 1.74 - uTime * 0.21) * 0.2
    )
  );
  float lensFlowEnvelope =
    lensEnvelope *
    mix(0.14, 0.68, coronaSideBias) *
    mix(0.38, 1.0, coronaOpenBias);
  float hullCoronaEnvelope =
    anchorRim *
    (1.0 - smoothstep(0.64, 1.36, max(hullDistance, 0.0))) *
    coronaSideBias *
    coronaOpenBias;

  vec2 field = rotate2(uFieldRotation - 0.12) * aspectUv * 0.72;
  field += vec2(uTime * 0.056, -uTime * 0.044);
  field += flowNormal * lensFlowEnvelope * uLensStrength * 0.2;
  field +=
    flowTangent *
    lensFlowEnvelope *
    uLensStrength *
    mix(0.09, 0.14, uMotionEnergy) *
    sin(uTime * 0.44 + hullDistance * 4.6);

  float warpX = fbm3(
    field * 0.68 + vec2(uTime * 0.026, -uTime * 0.019)
  );
  float warpY = fbm3(
    field * 0.76 + vec2(-uTime * 0.021, uTime * 0.028)
  );
  vec2 warped =
    field + (vec2(warpX, warpY) - 0.5) * uWarpAmount;
  float broadNoise = fbm3(
    warped * 0.58 + vec2(uTime * 0.014, -uTime * 0.011)
  );
  float sceneFlow = iterativeCorona(
    warped * 0.92,
    uTime * 0.82,
    broadNoise * 1.7 + uFieldRotation
  );

  vec2 coronaPoint = rotate2(uFieldRotation * 0.22) * anchorPoint;
  coronaPoint +=
    flowTangent *
    lensFlowEnvelope *
    (0.1 + uMotionEnergy * 0.09) *
    sin(uTime * 0.5 + hullDistance * 3.8);
  float coronaFlow = iterativeCorona(
    coronaPoint * mix(0.9, 0.82, uIsMobile),
    uTime,
    broadNoise * 2.1 + uAnchorFacing * 0.42
  );
  float coronaRidges = ridgeField(
    coronaPoint * mix(0.72, 0.64, uIsMobile) +
      flowTangent * coronaFlow * 0.08 +
      strokeTangent * strokeInfluence * 0.16,
    uTime * 0.72,
    coronaFlow
  );
  float coronaBreakup = mix(
    0.18,
    1.0,
    smoothstep(
      0.44,
      0.74,
      coronaFlow * 0.5 +
        broadNoise * 0.27 +
        (0.5 + 0.5 * sin(
          coronaPoint.y * 2.08 -
          coronaPoint.x * 1.16 -
          uTime * 0.31
        )) * 0.23
    )
  );
  float coronaEnvelope = hullCoronaEnvelope * coronaBreakup;
  float strokeFilamentEnvelope =
    exp(-max(strokeDistance, 0.0) * 4.1) *
    smoothstep(-0.06, 0.16, strokeDistance) *
    strokeFieldReach *
    coronaBreakup;
  float brokenCorona =
    coronaEnvelope *
    smoothstep(0.5, 0.8, coronaFlow * 0.7 + broadNoise * 0.3);
  float coronaFilaments =
    coronaRidges *
    (
      coronaEnvelope * (0.24 + coronaFlow * 0.46) +
      strokeFilamentEnvelope * (0.18 + strokeProximity * 0.42)
    );
  float coronaPlumes =
    coronaEnvelope *
    pow(
      1.0 - abs(
        sin(
          coronaPoint.y * 1.28 +
          coronaPoint.x * 0.54 +
          coronaFlow * 2.2 -
          uTime * 0.3
        )
      ),
      3.0
    );

  vec2 streamPoint =
    rotate2(uFieldRotation + 0.52) *
    (aspectUv - uAnchorCenter);
  streamPoint +=
    flowNormal *
    lensFlowEnvelope *
    uLensStrength *
    mix(0.48, 0.38, uIsMobile);
  streamPoint +=
    flowTangent *
    lensFlowEnvelope *
    uLensStrength *
    mix(0.11, 0.085, uIsMobile) *
    sin(uTime * 0.51 + hullDistance * 3.9 + coronaFlow * 1.2);

  float curveNoise =
    (broadNoise - 0.5) * 0.26 +
    (sceneFlow - 0.5) * 0.22;
  float primaryCurve =
    streamPoint.x +
    sin(
      streamPoint.y * 1.34 +
      uTime * 0.31 +
      coronaFlow * lensFlowEnvelope * 0.38
    ) * 0.3 +
    curveNoise +
    uMotionEnergy * 0.34;
  float secondaryCurve =
    streamPoint.x * 0.76 -
    streamPoint.y * 0.28 +
    cos(streamPoint.y * 0.88 - uTime * 0.25) * 0.22 +
    curveNoise * 0.72 -
    mix(0.74, 0.52, uIsMobile) -
    uMotionEnergy * 0.28;
  float primaryDistance = abs(primaryCurve);
  float secondaryDistance = abs(secondaryCurve);
  float primaryHalo = exp(
    -primaryDistance * primaryDistance * mix(10.0, 14.0, uIsMobile)
  );
  float primaryCore = exp(
    -primaryDistance * primaryDistance * mix(96.0, 118.0, uIsMobile)
  );
  float secondaryHalo = exp(
    -secondaryDistance * secondaryDistance * mix(18.0, 22.0, uIsMobile)
  );
  float secondaryCore = exp(
    -secondaryDistance * secondaryDistance * mix(132.0, 156.0, uIsMobile)
  );
  float organicPhase =
    warped.x * 1.76 +
    warped.y * 0.84 +
    (sceneFlow - 0.5) * 3.1 +
    sin(warped.y * 1.12 + uTime * 0.21) * 0.58;
  float organicWave = 1.0 - abs(sin(organicPhase));
  float organicHalo = pow(organicWave, 2.4);
  float organicCore = pow(organicWave, 9.0);
  float macroStream = clamp(
    primaryHalo * 0.54 +
    secondaryHalo * 0.34 +
    organicHalo * 0.24,
    0.0,
    1.0
  );
  float macroCore = max(
    max(primaryCore, secondaryCore * 0.72),
    organicCore * 0.52
  );

  float pulseGate = smoothstep(
    0.22,
    0.9,
    0.5 + 0.5 * sin(uTime * 0.62 + broadNoise * 4.0 + coronaFlow)
  );
  float pulseStreak = max(
    max(primaryCore, secondaryCore * 0.78),
    coronaFilaments * 0.72
  );
  pulseStreak *= pulseGate * uPulseStrength;

  float chroma = uChromaOffset * mix(1.0, 0.68, uIsMobile);
  vec2 microField = warped * mix(1.32, 1.18, uIsMobile);
  float ridgeR = ridgeField(
    microField - flowNormal * chroma,
    uTime,
    broadNoise
  );
  float ridgeG = ridgeField(microField, uTime, broadNoise);
  float ridgeB = ridgeField(
    microField + flowNormal * chroma,
    uTime,
    broadNoise
  );
  vec3 spectralRidge = vec3(ridgeR, ridgeG, ridgeB);
  float microCaustic =
    dot(spectralRidge, vec3(0.2126, 0.7152, 0.0722));
  microCaustic *= mix(0.1, 0.18, uMotionEnergy);

  float macroLight =
    macroStream * mix(0.058, 0.052, uIsMobile) +
    macroCore * mix(0.3, 0.27, uIsMobile);
  float pulseLight =
    smoothstep(0.035, 0.15, pulseStreak) *
    0.42;
  float microLight =
    smoothstep(0.045, 0.2, microCaustic) *
    0.09;
  float coronaLight =
    brokenCorona * mix(0.24, 0.19, uIsMobile) +
    coronaFilaments * mix(0.48, 0.38, uIsMobile) +
    coronaPlumes * mix(0.32, 0.25, uIsMobile);
  float lightSignal = macroLight + pulseLight + microLight + coronaLight;
  float highlight = smoothstep(0.035, 0.5, lightSignal);

  float intensity = clamp(uIntensity * uAnchorPresence, 0.0, 1.0);
  float readingSuppression =
    mix(1.0, 0.92, readingChannel * readingChannel);
  vec3 deepBase = vec3(0.001, 0.002, 0.005);
  vec3 blueAir =
    uColorA *
    (0.0012 + broadNoise * 0.0014 + macroStream * 0.0028);
  vec3 streamColor = mix(
    mix(uColorA * 0.58, uColorB, 0.28),
    uColorB,
    highlight
  );
  vec3 color =
    deepBase +
    blueAir +
    streamColor * lightSignal * intensity;
  color +=
    uColorB *
    macroCore *
    intensity *
    mix(0.04, 0.15, uIsMobile);
  color += uColorB * coronaLight * intensity * 0.7;

  vec3 amberEdge =
    vec3(0.718, 0.486, 0.286) *
    macroCore *
    coronaFilaments *
    highlight *
    0.038;
  color += amberEdge * intensity;

  float spectralMono =
    dot(spectralRidge, vec3(0.2126, 0.7152, 0.0722));
  vec3 spectralDelta = spectralRidge - vec3(spectralMono);
  color += spectralDelta * microCaustic * highlight * 0.08;
  color *= readingSuppression;

  gl_FragColor = vec4(color, 1.0);
}
`;
