# CoScroll Source-Match Gate

Status: gate opened after foundation commit `2daceca`.
Date: 2026-04-29.
Scope: restore the original CoScroll visual language before homepage scene switching.

## Boundary

The current MiraLith homepage `.coscroll-section` is a temporary placeholder. It must not be treated as migrated CoScroll runtime.

Do not expand homepage integration until this gate passes. In particular, do not switch the shared Canvas from LuBirth to CoScroll before the source-match spike matches the reference below.

## Live Reference

Reference capture:

![Original CoScroll active desktop reference](reference/source-coscroll-live-active-desktop.jpg)

Captured from the original project at `/Users/aitoshuu/Documents/GitHub/CoScroll`:

```bash
npm run dev -- -H 127.0.0.1 -p 3125
```

Capture conditions:

- URL: `http://127.0.0.1:3125`
- Viewport: `1440x960`
- Action: click the autoplay guard, wait for active render and model load
- Captured artifact: `docs/coscroll-source-match/reference/source-coscroll-live-active-desktop.jpg`

## Source Files To Match First

Use these source files as the implementation reference, in this order:

1. `/Users/aitoshuu/Documents/GitHub/CoScroll/src/components/backgrounds/SilkR3F.tsx`
2. `/Users/aitoshuu/Documents/GitHub/CoScroll/src/components/layouts/useLayeredLyrics.ts`
3. `/Users/aitoshuu/Documents/GitHub/CoScroll/src/components/layouts/LyricBillboard.tsx`
4. `/Users/aitoshuu/Documents/GitHub/CoScroll/src/components/layouts/UnifiedLyricsAndModel.tsx`
5. `/Users/aitoshuu/Documents/GitHub/CoScroll/src/components/jade/JadeModelLoader.tsx`

## Visual Acceptance

A source-match spike passes only if it restores these source-visible traits:

- Black-blue SilkR3F field, centered on source color `#1f2e38` and shader motion parameters close to `speed=4.9`, `noiseIntensity=1.3`, `rotation=2.42`.
- Cold cyan-white / ice-jade anchor material, not gold mineral jade.
- Vertical cold-white scripture columns with low-opacity outer columns and brighter center columns.
- Horizontal front/back lyric travel using the source `useLayeredLyrics` movement model.
- Real front/back depth relationship inside one Canvas, not DOM-only imitation.
- Edge feathering/masking similar to the source left/right lyric fade.

## Migration Order

1. Port SilkR3F into `packages/coscroll-scene` as canvas-less scene content suitable for the shared Canvas.
2. Port or adapt `useLayeredLyrics` as pure layout logic for the three-anchor MiraLith excerpt first.
3. Replace the current text billboard palette/layout with source-like `LyricBillboard` behavior.
4. Restore source-like Jade material defaults in GLB form, preserving the no-OBJ-runtime rule.
5. Only after source-match visual approval, connect homepage scene switching and lazy-loading.

## Guardrails

- Keep the original audio app shell, seek bar, Tone runtime, and full player UI out of MiraLith homepage.
- Keep first-screen `/assets/coscroll/` requests at zero.
- Keep exactly one production homepage Canvas.
- Keep CoScroll camera/background/fog mutations guarded by `active`.
- Any deliberate MiraLith deviation from the reference must be documented here before implementation.
