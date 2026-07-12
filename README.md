# MiraLith

MiraLith is a personal field site for Zuobowen Li: a visual narrative space that collects projects, experiments, commissions, and current work into one coherent world.

It is not planned as a normal portfolio. The first goal is to establish taste and memory through a Shopify Editions-like experience: fixed visual layer, DOM content layer, scroll-driven scenes, strict performance budgets, and graceful fallback.

## Current Direction

- **Primary reference**: Shopify Editions-style interactive release pages.
- **Core metaphor**: LuBirth as the origin field, followed by family systems, digital ritual, ambient browser work, experiment constellations, commissions, current building, and contact.
- **v1.0 release scope**: make the LuBirth first two screens feel exceptional before expanding the full homepage.
- **Current homepage state**: the home route now starts with a LuBirth-specific loading ritual that uses the Three scene's projected Earth horizon and Moon position when available, then hands off into the LuBirth field, title rail, and project intro.
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
- [Shopify reference](reference/shopify.md)

## Next Build Step

Continue from `docs/home-lubirth-next-stage-plan.md`. The next phase is LuBirth visual hardening: make the projection-based loading deterministic on slow starts, then resolve the earth-moon visual blockers recorded in `docs/lubirth-earthmoon-visual-gap-review.md` with screenshot-based acceptance.
