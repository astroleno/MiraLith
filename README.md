# MiraLith

MiraLith is a personal field site for Zuobowen Li: a visual narrative space that collects projects, experiments, commissions, and current work into one coherent world.

It is not planned as a normal portfolio. The first goal is to establish taste and memory through a Shopify Editions-like experience: fixed visual layer, DOM content layer, scroll-driven scenes, strict performance budgets, and graceful fallback.

## Current Implementation

- `apps/site` is a Next.js App Router app in the pnpm workspace.
- `/` carries the LuBirth-led visual field foundation.
- `/radio-gaga` is implemented as an independent RadioGaga case page on `codex/radio-gaga-route-branch`.
- RadioGaga includes the 3D radio scene, memory copy, tuned process artifact, ESP32 core reveal, mobile compositions, WebGL/model fallback, and e2e coverage.
- Latest verified RadioGaga checks: `pnpm build` and `pnpm exec playwright test tests/e2e/radio-gaga.spec.ts` with 18 passing tests.

## Current Direction

- **Primary reference**: Shopify Editions-style interactive release pages.
- **Core metaphor**: LuBirth as the origin field, followed by RadioGaga's family-care hardware story, digital ritual, ambient browser work, experiment constellations, commissions, current building, and contact.
- **v1.0 release scope**: make the LuBirth first two screens feel exceptional before expanding the full homepage.
- **v1.1 first slice**: RadioGaga now exists as a standalone route that can move through PR / integration review.
- **Language rhythm**: Chinese primary copy with English secondary lines.
- **Motion strategy**: Theatre.js participates from the start for the opening field-to-window timeline, while simple hover / idle motion stays outside Theatre.
- **Primary audience**: collaborators, clients, hiring / partnership contacts, creative technologists, designers, and people curious about AI-native visual products.
- **Tone**: mineral, lunar, ritual, archival, precise, restrained.

## Planning Docs

- [Project context](.planning/PROJECT.md)
- [Requirements](.planning/REQUIREMENTS.md)
- [Roadmap](.planning/ROADMAP.md)
- [Current state](.planning/STATE.md)
- [Repo scan](.planning/research/REPO_SCAN.md)
- [Stack and product notes](.planning/research/STACK_AND_PRODUCT_NOTES.md)

## Source Drafts

- [PRD](docs/prd.md)
- [MVP definition](docs/mvp.md)
- [Source project audit](docs/source-project-audit.md)
- [Tech stack](docs/tech-stack.md)
- [Top plan](docs/top-plan.md)
- [Interfaces](docs/interfaces.md)
- [LuBirth migration plan](docs/migration-plan.md)
- [CoScroll integration brief](docs/coscroll-integration-brief.md)
- [CoScroll scene interface](docs/coscroll-scene-interface.md)
- [RadioGaga route implementation plan](docs/radio-gaga/implementation-plan.md)
- [RadioGaga post-review follow-up plan](docs/radio-gaga/post-review-plan.md)
- [Shopify reference](reference/shopify.md)

## Next Build Step

Move the RadioGaga route through PR / integration review, then decide whether to surface it from the homepage or keep it as the first standalone case page while LuBirth remains the primary entry.
