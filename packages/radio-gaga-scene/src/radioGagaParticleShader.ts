export interface RadioGagaParticleShaderUniforms {
  uOpacity: { value: number };
  uPointSize: { value: number };
}

export const radioGagaParticleVertexShader = /* glsl */ `
  varying vec3 vColor;
  uniform float uPointSize;

  void main() {
    vColor = color;
    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = max(1.0, uPointSize * 900.0 / max(1.0, -modelViewPosition.z));
  }
`;

export const radioGagaParticleFragmentShader = /* glsl */ `
  varying vec3 vColor;
  uniform float uOpacity;

  void main() {
    float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
    float softDisc = 1.0 - smoothstep(0.34, 0.5, distanceFromCenter);
    if (softDisc <= 0.001) discard;
    gl_FragColor = vec4(vColor, softDisc * uOpacity);
  }
`;
