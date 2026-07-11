# Agent Guidelines - MiraLith

## Knowledge Graph Protocol (MANDATORY)

All agents working on this codebase MUST follow this protocol.

### Step 1: Check Graph Exists

Before any work, verify the knowledge graph is available:

```bash
if [ ! -f graphify-out/graph.json ]; then
    echo "Building knowledge graph..."
    /graphify
fi
```

### Step 2: Query Before Exploring

**WRONG**: Reading files directly with Grep/Glob/Read
**RIGHT**: Query the graph first to understand structure

```bash
# GOOD: Query graph for context
/graphify query "atmosphere rendering components"

# GOOD: Find path between modules
/graphify path "LuBirth" "visual core"

# GOOD: Explain a specific node
/graphify explain "CoScrollSceneSlot"
```

### Step 3: Use Graph-Aware Tools

When the graph exists, prefer these tools in order:

1. **graphify query** - For broad exploration
2. **graphify path** - For dependency tracing
3. **graphify explain** - For understanding specific nodes
4. **Grep/Glob** - Only when graph lacks information
5. **Read** - Targeted file reading after graph context

### Graph Commands Reference

| Command | Use When | Example |
|---------|----------|---------|
| `/graphify` | Building/updating graph | Initial setup or after major changes |
| `/graphify query "X"` | Finding related concepts | `query "particle system"` |
| `/graphify query "X" --dfs` | Tracing specific chains | `query "data flow" --dfs` |
| `/graphify path "A" "B"` | Finding connections | `path "LuBirth" "Radio Gaga"` |
| `/graphify explain "X"` | Understanding a node | `explain "VisualCanvas"` |
| `/graphify --update` | After code changes | Incremental update |

## Community Awareness

The codebase is organized into 103 communities. Key ones:

### Core Visual (High Priority)
- **Community 18**: Atmosphere Rendering - `packages/lubirth-hero/`
- **Community 21**: Scene Slots - `apps/site/visual/scenes/`
- **Community 27**: Visual Canvas - `apps/site/visual/`
- **Community 29**: Atmosphere Policy - Quality/rendering policies

### Scene Packages
- **Community 28**: CoScroll Assets - `packages/coscroll-scene/`
- **Community 24**: LuBirth Hero Route - Main experience
- **Community 35**: Radio Gaga Page - `app/radio-gaga/`

### Infrastructure
- **Community 15**: Asset Management - Texture loading, budgets
- **Community 26**: Theatre Timeline - Animation timeline
- **Community 31**: Moon Phase - Astronomical calculations

## God Nodes (Handle with Care)

These high-centrality nodes are critical infrastructure:

| Node | Edges | Role | Caution |
|------|-------|------|---------|
| `set()` | 212 | State management | Changes affect many modules |
| `get()` | 178 | Data access | Widely used for configuration |
| `push()` | 149 | Collection ops | Core to array handling |
| `Vector3` | 76 | 3D math | Geometry calculations |
| `warn()` | 73 | Logging | Debug infrastructure |

**Rule**: Before modifying a god node, run `/graphify path` to check blast radius.

## Cross-Module Changes

When changes span multiple packages:

1. **Map the path**: `/graphify path "source" "target"`
2. **Check communities**: Note which communities are involved
3. **Read god nodes**: Check if any god nodes are in the path
4. **Update graph**: Run `/graphify --update` after changes

## File Reading Priority

When you must read files, prioritize by community cohesion:

1. High cohesion (0.5+) - Self-contained, safe to modify
2. Medium cohesion (0.2-0.5) - Some external connections
3. Low cohesion (<0.2) - Highly connected, changes have broad impact

Check cohesion in GRAPH_REPORT.md community sections.

## Update Triggers

Run `/graphify --update` after:

- New package added
- Public API changes
- New exports from index.ts
- Cross-module dependencies changed
- Major refactoring

## Anti-Patterns

### ❌ DON'T
- Read files without checking graph first
- Modify god nodes without path analysis
- Assume file organization matches logical structure
- Ignore community boundaries

### ✅ DO
- Query graph for context
- Use path tracing for dependencies
- Respect community cohesion
- Update graph after structural changes

## Emergency: Graph Out of Sync

If the graph seems incorrect:

```bash
# Force rebuild
rm -rf graphify-out/
/graphify
```

## Resources

- [CLAUDE.md](CLAUDE.md) - Full project guide
- [GRAPH_REPORT](graphify-out/GRAPH_REPORT.md) - Graph audit
- [README](README.md) - Project overview
