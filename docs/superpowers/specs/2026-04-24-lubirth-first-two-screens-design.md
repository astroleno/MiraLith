# LuBirth First Two Screens Design Spec

Status: draft for implementation planning  
Date: 2026-04-24  
Source docs: `docs/prd.md`, `docs/tech-stack.md`, `docs/interfaces.md`, `docs/migration-plan.md`

## Goal

Ship MiraLith v1.0 as a lightweight, production-safe LuBirth homepage opening: one shared site-owned WebGL canvas renders the Opening ritual field and the LuBirth zoomable project window, while DOM content remains accessible, indexable, and usable under fallback.

## Current State

The frontend skeleton exists:

- `apps/site` renders a Next App Router homepage.
- `apps/site/components/MiraLithHome.tsx` and `LuBirthWindow.tsx` render DOM/CSS placeholder frames.
- `packages/lubirth-hero` exports initial `EarthMoonScene` and `EarthMoonHero`.
- Current `EarthMoonHero` creates its own `Canvas`, so it is demo/dev-wrapper behavior, not the production homepage path.
- `packages/visual-core` contains initial quality, scroll, and opening timeline helpers.
- `pnpm typecheck` passes.

The missing production boundary is the important part:

- No site-owned `VisualCanvas` exists yet.
- `EarthMoonScene` is not mounted from `apps/site` inside a shared fixed canvas.
- Production fallback, canvas accessibility, and context-loss routing are not wired.

## Scope

This spec covers MiraLith v1.0 only:

- 00 Intro / loading mark.
- 01 Opening / LuBirth Ritual Field.
- 02 LuBirth Zoomable Project Window.

This spec does not include Radio Gaga, CoScroll, ArtBreeze, constellation, full project detail pages, CMS, audio, LuBirth debug UI, or any LuBirth full-app embedding.

## Architecture

Production homepage architecture has three layers:

1. DOM content layer in `apps/site`: copy, project metadata, buttons, modal state, SEO, accessible names.
2. Fixed WebGL canvas layer in `apps/site` / `packages/visual-core`: one canvas for opening, LuBirth window, and future scenes.
3. Scene package layer in `packages/lubirth-hero`: `EarthMoonScene`, `LandingEarth`, `LandingMoon`, `LandingAtmosphere`, `LandingAurora`, presets, and asset contracts.

`EarthMoonHero` remains a standalone demo/dev wrapper. It may create its own `Canvas` only outside the production homepage.

## Production Data Flow

```text
apps/site page
  -> MiraLithHome
    -> VisualCanvas
      -> LuBirthSceneSlot
        -> resolveLandingPreset(mode, quality, viewport)
        -> EarthMoonScene
          -> LandingEarth
          -> LandingMoon
          -> LandingAtmosphere
          -> LandingAurora

DOM sections
  -> scroll progress / hover / tap / expanded state
    -> scene mode: field | window | zoomed | expanded
    -> scene props, not a new canvas
```

## Visual Requirements

Opening / field mode:

- Fixed date moon defaults to `1993-08-01T12:00:00Z`.
- Earth rotates slowly.
- Moon is screen-anchored in the same canvas, not FBO PIP.
- Fixed sun direction keeps composition stable.
- Atmosphere includes subtle rim, thin shell, and Karman-line-like arc glow.
- Aurora is procedural and disabled or simplified on low quality.
- DOM title and copy do not sit inside a card and do not block the core earth/moon composition on mobile landscape.

Project window mode:

- Same scene transitions into a smaller project-window composition.
- Window supports visible small frame, zoomed state, and expanded state.
- Expanded may request higher quality assets after user intent.
- Closing expanded releases high-cost state and returns focus to the trigger.

## Performance Requirements

- Mobile first-screen transfer hard limit: 3 MB.
- Target mobile first-screen transfer: 2.4 MB.
- First usable viewport: acceptable DOM plus fallback or WebGL visual appears within 3 seconds.
- Mobile DPR is clamped to `1` or `1.25` by quality tier.
- Low tier disables or reduces aurora, star count, high segment geometry, and noncritical textures.
- Expanded assets never preload before user intent.
- Runtime astronomy must not enter the first critical path for the fixed date.

## Accessibility and Fallback

Production accessibility is owned by `VisualCanvas` or the site fixed canvas wrapper:

- Decorative canvas uses `aria-hidden`.
- Non-decorative canvas gets a concise `aria-label`.
- DOM content contains all meaningful copy and links.
- Fallback poster carries the same label/description as the WebGL view.
- Expanded state traps focus, supports Esc, and returns focus to the trigger.
- Tab order never enters hidden canvas-only controls.

Fallback activates for:

- WebGL unavailable.
- WebGL context lost and not restored quickly.
- Critical texture failure.
- Runtime shader compile failure.
- Reduced-motion plus fallback quality.
- Device quality detection returning fallback.

Fallback renders site-owned DOM/poster content. It does not mount `EarthMoonHero` in production.

## Component Boundaries

`apps/site` owns:

- `VisualCanvas`.
- Homepage scroll and section state.
- DOM copy and links.
- Production fallback routing.
- Canvas accessibility.
- Modal state and keyboard flow.

`packages/visual-core` owns:

- Quality tier resolution.
- Reduced-motion helpers.
- Scroll progress driver.
- Theatre/opening timeline helpers.
- Shared visual types that do not depend on a concrete scene package.

`packages/lubirth-hero` owns:

- `EarthMoonScene`.
- `LandingEarth`.
- `LandingMoon`.
- `LandingAtmosphere`.
- `LandingAurora`.
- LuBirth presets.
- LuBirth asset manifest contracts.

`packages/lubirth-hero` must not import from `apps/site`. `EarthMoonScene` must not create a canvas.

## Testing Requirements

Required automated checks:

- TypeScript passes across the workspace with `pnpm typecheck`.
- Build passes with `pnpm build`.
- Playwright desktop proves exactly one production canvas exists and the placeholder-only state is gone.
- Playwright mobile portrait proves DOM remains readable.
- Playwright mobile landscape proves opening and window composition do not hide core earth/moon visual.
- Playwright expanded-state check proves open, Esc close, and focus return.
- WebGL nonblank pixel check proves the canvas renders visible pixels.
- Fallback route check proves forced fallback shows poster and complete DOM content.
- First-visible marker check proves `window.__MiraLithFirstUsableAt` is set within 3 seconds in local production mode.

## Implementation Slices

1. Production canvas ownership: create `VisualCanvas`, scene slot, and e2e checks.
2. LuBirth scene decomposition: split the existing scene into focused `Landing*` components.
3. Composition and fixed moon contract: expand types and presets without importing runtime astronomy.
4. Two-screen interaction: field, window, zoomed, expanded states through props and DOM controls.
5. Production fallback and a11y: site-owned poster/fallback and keyboard contract.
6. Performance budget and final verification: asset manifest, quality gates, nonblank pixel, first-visible, and docs sync.

## Risks

Duplicate canvas is the highest architecture risk. The implementation must keep production canvas creation inside `apps/site` / `visual-core` and keep `EarthMoonHero` out of the production homepage.

Bundle and memory growth are the highest delivery risks. The implementation must treat the first screen as a constrained visual, not as a full LuBirth port.

Mobile landscape composition is the highest visual acceptance risk. It needs a smoke test in M1 and full verification in M5.
