# MiraLith

MiraLith is a personal field site for Zuobowen Li: a visual narrative space that collects projects, experiments, commissions, and current work into one coherent world.

It is not planned as a normal portfolio. The first goal is to establish taste and memory through a Shopify Editions-like experience: fixed visual layer, DOM content layer, scroll-driven scenes, strict performance budgets, and graceful fallback.

## Current Direction

- **Primary reference**: Shopify Editions-style interactive release pages.
- **Core metaphor**: LuBirth as the origin field, followed by family systems, digital ritual, ambient browser work, experiment constellations, commissions, current building, and contact.
- **v1.0 release scope**: make the LuBirth first two screens feel exceptional before expanding the full homepage.
- **Current homepage state**: the home route runs LuBirth first and Radio Gaga second through one production Canvas. Radio Gaga reuses the existing radio/ESP32 GLBs and loads its scene and proof assets only when the second act is near.
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
- [Home LuBirth next-stage plan](docs/home-lubirth-next-stage-plan.md)
- [Interfaces](docs/interfaces.md)
- [LuBirth migration plan](docs/migration-plan.md)
- [LuBirth earth-moon visual gap review](docs/lubirth-earthmoon-visual-gap-review.md)
- [CoScroll integration brief](docs/coscroll-integration-brief.md)
- [CoScroll scene interface](docs/coscroll-scene-interface.md)
- [Radio Gaga migration acceptance](docs/migrations/radio-gaga-acceptance.md)
- [Shopify reference](reference/shopify.md)

## Next Build Step

Use `docs/migrations/radio-gaga-acceptance.md` as the current homepage handoff. Any CoScroll integration must rebase onto the shared home spine, add a near-mounted chapter runtime, and preserve the single production Canvas.
