import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("layers plate and veil inside a Canvas-scoped isolated stack", () => {
  const plate = source(
    "apps/site/components/lubirth-cinematic-prelude/CinematicPlate.tsx"
  );
  const veil = source(
    "apps/site/components/lubirth-cinematic-prelude/TransitionVeil.tsx"
  );
  const stack = source(
    "apps/site/components/lubirth-cinematic-prelude/LuBirthCinematicPreludeStack.tsx"
  );
  const css = source(
    "apps/site/components/LuBirthCinematicPreludeRoute.module.css"
  );

  expect(plate).toContain("data-cinematic-plate");
  expect(plate).toContain("data-active-source");
  expect(veil).toContain("data-transition-veil");
  expect(veil).toContain('data-layer-above="plate canvas"');
  expect(stack.indexOf("{children}")).toBeLessThan(
    stack.indexOf("<CinematicPlate")
  );
  expect(stack.indexOf("<CinematicPlate")).toBeLessThan(
    stack.indexOf("<TransitionVeil")
  );
  expect(css).toMatch(/\.stack\s*\{[^}]*isolation:\s*isolate/s);
  expect(css).toMatch(/\.plate\s*\{[^}]*z-index:\s*2/s);
  expect(css).toMatch(/\.veil\s*\{[^}]*z-index:\s*3/s);
  expect(css).toMatch(/pointer-events:\s*none/);
  expect(css).not.toContain(":global");
});
