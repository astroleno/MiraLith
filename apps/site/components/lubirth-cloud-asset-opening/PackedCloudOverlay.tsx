"use client";

import { useEffect, useRef } from "react";
import type { OpeningCloudVariant } from "../../content/lubirthOpeningCloudManifest";
import styles from "../LuBirthCloudAssetOpeningRoute.module.css";

const VERTEX_SOURCE = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uPackedCloud;
uniform float uSourceAspect;
uniform float uDestinationAspect;
in vec2 vUv;
out vec4 outColor;

vec2 coverUv(vec2 uv) {
  if (uDestinationAspect > uSourceAspect) {
    uv.y = 0.5 + (uv.y - 0.5) * (uSourceAspect / uDestinationAspect);
  } else {
    uv.x = 0.5 + (uv.x - 0.5) * (uDestinationAspect / uSourceAspect);
  }
  return uv;
}

void main() {
  vec2 uv = coverUv(vUv);
  vec3 rgb = texture(uPackedCloud, vec2(uv.x * 0.5, uv.y)).rgb;
  float encodedAlpha = texture(uPackedCloud, vec2(0.5 + uv.x * 0.5, uv.y)).r;
  float alpha = smoothstep(0.035, 0.94, encodedAlpha);
  if (alpha < 0.003) discard;
  outColor = vec4(rgb, alpha);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate opening cloud shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error("Unable to compile opening cloud shader: " + (gl.getShaderInfoLog(shader) ?? "(no driver diagnostic)"));
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to allocate opening cloud program");
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Unable to link opening cloud program");
  }
  return program;
}

export function PackedCloudOverlay({
  renderedFrame,
  variant,
  video,
  onRenderingFallback
}: {
  renderedFrame: number | null;
  variant: OpeningCloudVariant;
  video: HTMLVideoElement | null;
  onRenderingFallback: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackReportedRef = useRef(false);
  const drawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;

    let disposed = false;
    let frameHandle: number | null = null;
    let gl: WebGL2RenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let texture: WebGLTexture | null = null;
    let vertices: WebGLBuffer | null = null;

    const reportFallback = () => {
      if (fallbackReportedRef.current) return;
      fallbackReportedRef.current = true;
      onRenderingFallback();
    };

    try {
      gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        premultipliedAlpha: false
      });
      if (!gl) throw new Error("WebGL2 is unavailable for packed cloud presentation");
      program = createProgram(gl);
      texture = gl.createTexture();
      vertices = gl.createBuffer();
      if (!texture || !vertices) throw new Error("Unable to allocate opening cloud presentation resources");

      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    } catch {
      reportFallback();
      return;
    }

    const draw = () => {
      if (disposed || !gl || !program || !texture || !vertices) return;
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.max(1, Math.round(rect.width * pixelRatio));
      const height = Math.max(1, Math.round(rect.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      } catch {
        reportFallback();
        return;
      }
      gl.uniform1i(gl.getUniformLocation(program, "uPackedCloud"), 0);
      gl.uniform1f(gl.getUniformLocation(program, "uSourceAspect"), variant.width / variant.height);
      gl.uniform1f(gl.getUniformLocation(program, "uDestinationAspect"), width / height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    drawRef.current = draw;
    frameHandle = window.requestAnimationFrame(draw);
    return () => {
      disposed = true;
      drawRef.current = null;
      if (frameHandle !== null) window.cancelAnimationFrame(frameHandle);
      if (!gl) return;
      if (vertices) gl.deleteBuffer(vertices);
      if (texture) gl.deleteTexture(texture);
      if (program) gl.deleteProgram(program);
    };
  }, [onRenderingFallback, variant, video]);

  useEffect(() => {
    if (!drawRef.current) return;
    const frameHandle = window.requestAnimationFrame(() => drawRef.current?.());
    return () => window.cancelAnimationFrame(frameHandle);
  }, [renderedFrame]);

  return (
    <canvas
      aria-hidden="true"
      className={styles.cloudOverlay}
      data-cloud-frame={renderedFrame ?? ""}
      data-cloud-packing="left-rgb-right-alpha"
      data-opening-cloud-overlay
      ref={canvasRef}
    />
  );
}
