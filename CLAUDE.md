# Expertrees — Claude Instructions

## What this repo is

Open-source TypeScript monorepo. Publishes four npm packages under the `@expertrees` scope:

| Package | Description |
|---------|-------------|
| `@expertrees/core` | Framework-agnostic engine — Canvas 2D renderer, D3 force layout, interaction controller, LOD system, theming |
| `@expertrees/vue` | Vue 3 component (`SkillTree`) + composable (`useSkillTree`) |
| `@expertrees/react` | React component (`ExpertreeCanvas`) + hook (`useExpertree`) |
| `@expertrees/angular` | Angular standalone component (`ExpertreeCanvasComponent`), built with ng-packagr |

GitHub repo: `https://github.com/0xMack/expertrees`

The library powers the interactive skill tree on the About page of `mackinations.ca` (via `@expertrees/vue`). The live consumer is at `C:\Users\mackp\dev\mack\mackinations\apps\flagship\app\pages\about.vue`.

---

## Monorepo structure

```
packages/
  core/        # Zero-dependency engine
  vue/         # Vue adapter
  react/       # React adapter
  angular/     # Angular adapter
.changeset/    # Changeset config + pending changeset files
.github/
  workflows/
    ci.yml       # Typecheck + build + test on push/PR
    release.yml  # Changesets release workflow — creates Version PR or publishes
```

**Tooling:** npm workspaces + Turborepo. `turbo.json` enforces `^build` dependency so core always builds before adapter tests run.

---

## Common commands

```bash
npm run build       # turbo build (all packages)
npm run test        # turbo test
npm run typecheck   # turbo typecheck
npm run dev         # turbo dev (watch mode)

npm run changeset   # create a new changeset (prompts for packages + bump type)
npm run version     # consume changesets → bump versions + update changelogs
npm run release     # turbo build && changeset publish (run by CI, not manually)
```

---

## Release pipeline

All four packages are **lockstepped** — they always release at the same version (`fixed` group in `.changeset/config.json`). Current published version: `0.1.1`.

### Patch releases (fully automated)
1. Open a PR with code changes
2. Run `npm run changeset` locally, commit the `.changeset/*.md` file with the PR
3. Merge to `main`
4. **CI** (`ci.yml`) runs typecheck + build + test
5. **Release** (`release.yml`) runs changesets/action:
   - If unpublished changesets exist → creates/updates a "chore: version packages" Version PR
   - If Version PR is merged → publishes to npm automatically

### Minor / major releases
Same flow, but create the changeset with `minor` or `major` bump type. This gives you control — the Version PR sits open until you merge it.

### npm publishing
Uses **OIDC Trusted Publishing** (no long-lived npm tokens). Configured on npmjs.com for all four packages: org `0xMack`, repo `expertrees`, workflow `release.yml`, no environment.

Key workflow detail: `NPM_CONFIG_USERCONFIG=/dev/null` is set as an env var on the changesets/action step. This prevents any pre-configured `_authToken` from interfering with npm's native OIDC token exchange (which only triggers when no auth token is configured).

---

## Architecture decisions

- **Canvas 2D over WebGL** — handles hundreds of animated nodes at 60fps without shader complexity. WebGL is a future upgrade path.
- **D3 force layout** — produces organic, naturally-spaced arrangements. Non-deterministic positions are intentional (the drift gives it life). Makes pixel-perfect snapshot tests impractical.
- **Stack-based context navigation** — only the current context's children are rendered. Entering a node pushes to the nav stack; going back pops it. `jumpToNavDepth()` collapses multi-level back-navigation atomically to avoid mid-transition state corruption.
- **One core, four adapters** — the core is a pure `HTMLCanvasElement` consumer with zero framework deps. Each adapter is a thin mount/unmount + event forwarding wrapper.
- **`fixed` changeset group** — all four packages always release together. Consumers only need to keep one version number in sync.

---

## Key types (`@expertrees/core`)

```ts
SkillGraph      // { id, label, nodes: SkillNode[], edges: SkillEdge[] }
SkillNode       // { id, label, depth, parentId?, childIds?, state?, evidence? }
SkillEdge       // { id, source, target, directed } — only cross-depth edges
Evidence        // { id, type: 'link'|'text', label, url? } — stored, not rendered
NodeState       // 'default' | 'active' | 'locked' | 'unlocked' | 'highlighted'
NavigationFrame // { nodeId, label } — one entry per level in the nav stack
ThemeInput      // Partial overrides for colors, glow, LOD thresholds
```

**Rule:** Evidence is metadata-only — the library stores it, the host app renders it (e.g. in a side panel). The library never renders evidence UI.

---

## tsconfig

`tsconfig.base.json` at the root sets `target: ES2022` (required for `Array.prototype.at()`). Each package extends it.

---

## Gotchas

- `@expertrees/angular` builds with `ng-packagr`, not Vite. Its build output goes to `dist/` and is structured for Angular's package format.
- The Vue tests use `happy-dom` and `@vue/test-utils`. The React package currently has no tests.
- `npm run release` is only meant to be run by CI — running it locally will attempt to publish to npm.
- If the Version PR ("chore: version packages") is already open, merging another changeset to `main` will update the existing PR rather than create a new one.
