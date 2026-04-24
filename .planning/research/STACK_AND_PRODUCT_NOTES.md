# Stack and Product Notes

**Date:** 2026-04-24  
**Basis:** Existing MiraLith docs plus rough scan of related local repositories.

## Product Direction

The PRD is directionally strong. The phrase "personal field site" is doing real work: it prevents the site from collapsing into a normal portfolio grid while still leaving room for contact, credibility, and commercial intent.

The best product call is to keep LuBirth first. It gives MiraLith a mythic origin and a strong visual memory. Radio Gaga, CoScroll, and ArtBreeze then read as emotional / ritual / daily-scale expansions rather than unrelated projects.

## What Feels Most Reasonable

- Shopify as a reference is reasonable if it means layered architecture, orchestration, high polish, and performance discipline.
- Next.js App Router is reasonable for the main site because routes, metadata, project pages, static generation, and Vercel deployment matter.
- R3F / Three.js is justified because LuBirth and CoScroll already live in that ecosystem.
- pnpm workspace is justified because visual packages should have boundaries.
- Typed local content is right for v1; CMS is premature.
- Theatre.js should be staged, not first dependency. Start with static render and simple interpolation, then add timeline editing when the visual state is stable.

## Main Risk

The project can fail by trying to match Shopify's surface complexity too early. Shopify-level pages are impressive because of their motion pipeline and asset discipline, not because every section is immediately 3D.

The v1 risk is therefore not insufficient ambition. The risk is loading LuBirth, CoScroll, Radio Gaga, ArtBreeze, constellation, detail pages, Rive, Theatre, and full assets before the first two screens are excellent.

## Recommended v1 Philosophy

Build a strong spine:

1. Great first impression.
2. Clear DOM content.
3. One lightweight visual kernel.
4. Budgeted assets.
5. Fallbacks from day one.

Then grow chapters.

## Stack Recommendation

| Layer | Recommended | Reason |
| --- | --- | --- |
| Framework | Next.js App Router | Routing, static generation, metadata, deployment |
| Language | TypeScript strict | Visual and content contracts need safety |
| Package manager | pnpm workspace | Site + visual packages + future scenes |
| Styling | CSS variables + Tailwind + CSS Modules | Tokens and layout speed without trapping complex visuals in utility classes |
| 3D | Three.js + R3F + Drei | Matches source projects and desired experience |
| State | Zustand | Section, quality, modal, and visual state without React render churn |
| Motion | CSS / Motion for DOM, Theatre.js later for visual timelines | Keeps early complexity under control |
| Content | Typed local data, optional MDX later | Fast iteration, low operational burden |
| Verification | Playwright + bundle analyzer + Lighthouse | Required for visual confidence and budget control |
| Deploy | Vercel | Natural fit for Next and mostly static pages |

## PRD Adjustments Worth Discussing

- Decide whether v1 is bilingual. Bilingual improves range but doubles copy and layout QA.
- Decide whether v1 must include all chapters, or whether a stunning LuBirth + selected project path is acceptable.
- Decide whether project details are necessary at launch. They add credibility but can slow visual launch.
- Decide whether contact should be subtle or more explicit. The current tone implies subtle.
- Decide whether analytics should exist in v1. Useful, but not necessary for launch.

## Long-Term Goal Check

The long-term goal is reasonable if staged:

- v1: field-site launch with LuBirth-led narrative.
- v1.1: stronger detail pages and constellation.
- v2: shared fixed canvas with more portal scenes and polished timeline tooling.
- v3: living archive / public operating surface with case studies, notes, experiments, and maybe CMS.

Do not make v1 carry v3's infrastructure.

