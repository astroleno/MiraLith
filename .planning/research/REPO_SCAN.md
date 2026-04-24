# MiraLith Repo Scan

**Date:** 2026-04-24  
**Scope:** Rough local scan of `/Users/aitoshuu/Documents/GitHub` for projects referenced by the MiraLith concept.

## MiraLith

Current repo contains documentation only:

- `docs/prd.md`
- `docs/tech-stack.md`
- `docs/top-plan.md`
- `docs/interfaces.md`
- `docs/migration-plan.md`
- `docs/coscroll-integration-brief.md`
- `reference/shopify.md`

No app scaffold exists yet. Git was initialized on `main`.

## Source Projects

| Project | Observed stack / shape | MiraLith role | Migration note |
| --- | --- | --- | --- |
| `LuBirth` | React 18, Vite, TypeScript, Three.js, R3F, Drei, `astronomy-engine` | Origin field and first project window | Extract visual ideas and selected algorithms only; original textures are about 20MB and unsuitable for first-screen budget |
| `CoScroll` | Next 14, TypeScript, R3F, Drei, postprocessing, Zustand, TanStack Query, Troika text, audio | Digital ritual chapter | Extract jade model / lyric occlusion / ritual feeling; avoid full app, audio engine, full model set, and 5.8MB font |
| `radio-gaga` | Vite React frontend, Cloudflare/n8n-oriented docs | Family / AI podcast chapter | Use as narrative and visual source; homepage should show concept flow, not embed console |
| `ArtBreeze-public` | Chrome extension | Ambient browser / daily ritual chapter | Use the waiting-to-art transformation as a small breathing section |
| `SonoScope` | Next-style monorepo with packages, audio visualization, plugin architecture | Experiment constellation / audio-visual systems | Good proof of system thinking; likely not a mainline chapter in v1 |
| `UGCFlow` | React 19 / Vite frontend, Express, WebSocket, SQLite, Playwright | Now building / AI production system | Strong credibility signal; keep late in narrative |
| `fv_website` | Vite, React 19, R3F, Drei, GSAP, Framer Motion | Now building / Feeling Video public angle | Useful for current work section |
| `licharlieshi_portfolio` | Vite, React 19, GSAP | Selected commission | Credibility layer, not core worldbuilding |
| `dulwich_animation` | Vite, React 18, R3F, GSAP, Playwright | Selected commission | Credibility layer and proof of motion delivery |

## Asset Reality Check

- `LuBirth/public/textures`: about 20MB.
- `CoScroll/public/models`: about 32MB.
- `CoScroll/public/fonts`: about 5.8MB.
- `CoScroll/public/audio`: about 20MB.

This confirms the existing PRD warning: MiraLith should not embed source apps or raw asset folders. It needs curated, compressed, per-section assets.

## Stack Pattern Across Projects

Local projects are already React / TypeScript heavy, with a mix of Vite and Next. Visual projects repeatedly use R3F / Drei / Three.js. Several newer projects use React 19 and Vite 6, but the MiraLith main-site recommendation remains Next because this site needs static routes, metadata, SEO, project pages, and content organization more than pure demo speed.

## Practical Implication

The right v1 path is:

1. Scaffold a proper Next / pnpm workspace.
2. Create typed content first.
3. Extract a lightweight LuBirth package before touching CoScroll.
4. Budget every asset before it enters the app.
5. Let source projects remain source projects.

