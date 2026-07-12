# CLAUDE.md - MiraLith Project Guide

## Knowledge Graph (REQUIRED)

This project maintains a [graphify](https://github.com/safishamsi/graphify) knowledge graph at `graphify-out/`. **All agents MUST use the graph before exploring the codebase.**

### Before You Start

```bash
# Check if graph exists
ls graphify-out/graph.json

# If missing, build it first
/graphify
```

### Agent Workflow

1. **Query the graph first** - Always use `/graphify query` to understand the codebase structure
2. **Find relevant communities** - Check GRAPH_REPORT.md for community hubs
3. **Trace connections** - Use `/graphify path` to understand cross-module relationships
4. **Read source files** - Only after understanding the graph context
5. **Update after changes** - Run `/graphify --update` after significant refactoring

### Essential Commands

```bash
# Query concepts
/graphify query "atmosphere rendering"
/graphify query "how does LuBirth connect to CoScroll"

# Find paths between modules
/graphify path "LuBirth" "Radio Gaga"

# Explain specific nodes
/graphify explain "VisualCanvas"

# Update after code changes
/graphify --update
```

### Graph Structure

- **562 nodes** - Functions, classes, concepts
- **670 edges** - Import, call, semantic relationships
- **108 communities** - Logical clusters
- **136 files** indexed

_Last updated: 2026-05-13_

### Key Communities

| ID | Name | Description |
|----|------|-------------|
| 18 | Atmosphere Rendering | Earth/Moon atmosphere shaders |
| 21 | Scene Slots | Visual scene management |
| 24 | LuBirth Hero Route | Main LuBirth experience |
| 27 | Visual Canvas | Core visual infrastructure |
| 28 | CoScroll Assets | Scroll-driven scene assets |
| 29 | Atmosphere Policy | Rendering quality policies |

### God Nodes (High-Impact Functions)

These nodes have high betweenness centrality - they connect multiple communities:

- `set()` - 212 edges - State management hub
- `get()` - 178 edges - Data access hub
- `push()` - 149 edges - Array/collection operations
- `Vector3` - 76 edges - 3D math operations

### When to Use the Graph

| Task | Graph Tool | Example |
|------|-----------|---------|
| Understand module relationships | `query` | `/graphify query "how scenes connect"` |
| Find cross-module dependencies | `path` | `/graphify path "LuBirth" "visual core"` |
| Locate specific functionality | `query` | `/graphify query "particle transition"` |
| Understand a component | `explain` | `/graphify explain "CoScrollSceneSlot"` |
| After refactoring | `--update` | `/graphify --update` |

### Outputs Location

- `graphify-out/graph.json` - Raw graph data
- `graphify-out/GRAPH_REPORT.md` - Full audit report
- `graphify-out/obsidian/` - Visual exploration vault

## Project Structure

```
packages/
  lubirth-hero/          # Earth/Moon atmosphere rendering
  coscroll-scene/        # Scroll-driven visual scenes
  radio-gaga-scene/      # Particle transition scene
  visual-core/           # Shared visual infrastructure

apps/site/               # Next.js application
  app/                   # Routes and pages
  components/            # React components
  visual/                # Visual canvas integration
```

## Tech Stack

- **Framework**: Next.js 15 + React 19
- **Visual**: Three.js + React Three Fiber
- **Animation**: Theatre.js + GSAP
- **Styling**: Tailwind CSS
- **Package Manager**: pnpm

## Agent Rules

1. **Graph First**: Always query the graph before reading source files
2. **Community Aware**: Note which community a file belongs to
3. **Cross-Module Care**: Use `/graphify path` to check blast radius
4. **Update Graph**: Run `--update` after structural changes
5. **Check God Nodes**: High-centrality nodes are critical - modify with care

## Documentation

- [README](README.md) - Project overview
- [GRAPH_REPORT](graphify-out/GRAPH_REPORT.md) - Knowledge graph audit
- `docs/` - Planning documents
- `reference/` - External references
