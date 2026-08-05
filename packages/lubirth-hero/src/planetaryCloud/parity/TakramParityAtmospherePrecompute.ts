import {
  PrecomputedTexturesGenerator,
  type PrecomputedTextures
} from "@takram/three-atmosphere";
import { useEffect, useState } from "react";
import type { WebGLRenderer } from "three";

export interface TakramParityAtmosphereState {
  atmosphereGeneration: number;
  error: Error | null;
  ready: boolean;
  textures: PrecomputedTextures | null;
}

function getNextAtmosphereGeneration(generation: number) {
  return Number.isSafeInteger(generation) && generation >= 0 ? generation + 1 : 0;
}

/**
 * Takram's Atmosphere starts with allocated-but-empty LUT targets when it owns
 * the generator internally. The parity route owns the documented upstream
 * generator instead, so its visual gate cannot capture those empty targets.
 * A restored WebGL context always receives a fresh generator and fresh LUTs.
 */
export function useTakramParityAtmospherePrecompute(
  renderer: WebGLRenderer,
  canvas: HTMLCanvasElement | null
): TakramParityAtmosphereState {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<TakramParityAtmosphereState>({
    atmosphereGeneration: 0,
    error: null,
    ready: false,
    textures: null
  });

  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    const onContextRestored = () => {
      setGeneration((current) => getNextAtmosphereGeneration(current));
    };
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    return () => canvas.removeEventListener("webglcontextrestored", onContextRestored);
  }, [canvas]);

  useEffect(() => {
    const generator = new PrecomputedTexturesGenerator(renderer);
    let mounted = true;
    setState({
      atmosphereGeneration: generation,
      error: null,
      ready: false,
      textures: null
    });

    void generator.update()
      .then((textures) => {
        if (!mounted) {
          return;
        }
        setState({
          atmosphereGeneration: generation,
          error: null,
          ready: true,
          textures
        });
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return;
        }
        setState({
          atmosphereGeneration: generation,
          error: error instanceof Error ? error : new Error(String(error)),
          ready: false,
          textures: null
        });
      });

    return () => {
      mounted = false;
      generator.dispose();
    };
  }, [generation, renderer]);

  return state;
}
