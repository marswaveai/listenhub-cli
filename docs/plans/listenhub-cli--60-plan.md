# ListenHub-CLI vite-plus Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate listenhub-cli's entire toolchain (build, lint, format, test, type-check) from tsc+xo to vite-plus, aligning with listenhub-sdk.

**Architecture:** Replace tsc compilation with `vp pack` (tsdown) to produce a single-file ESM bundle. Replace xo/Prettier with oxlint/oxfmt via `vp lint`/`vp fmt`. Add vitest skeleton via `vp test`. Centralize all tool config in `vite.config.ts`. Downgrade TypeScript to 5.x for vite-plus peer compat.

**Tech Stack:** vite-plus 0.1.18, vite 8.x, vitest 2.x, TypeScript 5.9.x, tsdown (via vp pack), oxlint (via vp lint), oxfmt (via vp fmt)

**Spec:** `docs/specs/listenhub-cli--60-design.md`

---

## File Map

| Action | File               | Purpose                                                 |
| ------ | ------------------ | ------------------------------------------------------- |
| Create | `vite.config.ts`   | Central vp config (pack entry, lint options)            |
| Create | `vitest.config.ts` | Vitest test runner config                               |
| Modify | `package.json`     | Scripts, deps, bin, files, remove overrides             |
| Modify | `tsconfig.json`    | Remove outDir/declaration (no longer compiling via tsc) |
| Modify | `.gitignore`       | Replace `distribution/` with `dist/`                    |
| Delete | `xo.config.mjs`    | Replaced by vp lint (oxlint)                            |

SDK (separate repo, separate commit):

| Action | File                                           | Purpose                      |
| ------ | ---------------------------------------------- | ---------------------------- |
| Modify | `~/coding/marswave/listenhub-sdk/package.json` | Upgrade vite-plus to ^0.1.18 |

---

### Task 1: Create vite.config.ts

**Files:**

- Create: `vite.config.ts`

- [ ] **Step 1: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["source/cli.ts"],
    platform: "node",
    format: ["esm"],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "chore: add vite.config.ts for vp pack/lint/check"
```

---

### Task 2: Update package.json — dependencies and overrides

**Files:**

- Modify: `package.json`

This task only changes dependencies, overrides, and engine-related fields. Scripts are updated in Task 3.

- [ ] **Step 1: Remove old dev dependencies and add new ones**

Remove these devDependencies:

- `xo`
- `del-cli`

Downgrade:

- `typescript`: `^6.0.2` → `^5.9.3`

Add new devDependencies:

- `vite-plus`: `^0.1.18`
- `vite`: `^8.0.3`
- `vitest`: `^2.0.0`

Keep unchanged:

- `@sindresorhus/tsconfig`: `^8.1.0`
- `@types/node`: `^25.5.0`

- [ ] **Step 2: Remove pnpm.overrides block**

Delete the entire `pnpm` section from `package.json`:

```json
"pnpm": {
  "overrides": {
    "typescript": "^6.0.2"
  }
}
```

- [ ] **Step 3: Run pnpm install**

```bash
pnpm install
```

Expected: lockfile updates, no peer dependency errors. Confirm `typescript` resolves to 5.9.x:

```bash
pnpm list typescript
```

Expected output includes `typescript 5.9.x` (not 6.x).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: migrate deps to vite-plus, downgrade typescript to 5.x"
```

---

### Task 3: Update package.json — scripts, bin, files

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Replace all scripts**

Replace the entire `scripts` block with:

```json
"scripts": {
  "dev": "vp pack --watch",
  "build": "vp pack",
  "lint": "vp lint",
  "lint:fix": "vp lint --fix",
  "fmt": "vp fmt",
  "fmt:check": "vp fmt --check",
  "check": "vp check",
  "test": "vp test run",
  "test:watch": "vp test",
  "ready": "vp check && vp test run",
  "prepublishOnly": "pnpm run build"
}
```

Removed scripts: `clean`, `pretest`.

- [ ] **Step 2: Update bin and files**

Change `bin` from:

```json
"bin": {
  "listenhub": "distribution/source/cli.js"
}
```

To:

```json
"bin": {
  "listenhub": "dist/cli.mjs"
}
```

Change `files` from:

```json
"files": [
  "distribution/source"
]
```

To:

```json
"files": [
  "dist"
]
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update scripts to vp commands, point bin to dist/cli.mjs"
```

---

### Task 4: Update tsconfig.json

**Files:**

- Modify: `tsconfig.json`

- [ ] **Step 1: Simplify tsconfig.json**

Replace the entire file with:

```json
{
  "extends": "@sindresorhus/tsconfig",
  "compilerOptions": {
    "rootDir": "source",
    "types": ["node"]
  },
  "include": ["source"]
}
```

Changes from current:

- Removed `"declaration": false` (tsc no longer compiles)
- Removed `"outDir": "distribution"` (vp pack handles output)
- Changed `"rootDir": "."` → `"rootDir": "source"` (matches SDK pattern, scopes type-check to source only)

- [ ] **Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "chore: simplify tsconfig for vp check (no longer used for compilation)"
```

---

### Task 5: Delete xo.config.mjs and update .gitignore

**Files:**

- Delete: `xo.config.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Delete xo config**

```bash
git rm xo.config.mjs
```

- [ ] **Step 2: Update .gitignore**

Replace the entire `.gitignore` with:

```
node_modules/
dist/
*.tsbuildinfo
```

Change: `distribution/` → `dist/`.

- [ ] **Step 3: Commit**

```bash
git add xo.config.mjs .gitignore
git commit -m "chore: remove xo config, update gitignore for dist/"
```

---

### Task 6: Create vitest.config.ts

**Files:**

- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest config**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
  },
});
```

This is a minimal skeleton. No test files exist yet — the config is here so `vp test run` has a valid config when tests are eventually added.

- [ ] **Step 2: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest.config.ts skeleton"
```

---

### Task 7: Build and verify the CLI bundle

**Files:** (no new files — verification only)

- [ ] **Step 1: Run the build**

```bash
pnpm build
```

Expected: `dist/cli.mjs` is created. No errors.

```bash
ls -la dist/cli.mjs
```

Expected: file exists, non-zero size.

- [ ] **Step 2: Verify shebang is present**

```bash
head -1 dist/cli.mjs
```

Expected: `#!/usr/bin/env node`

- [ ] **Step 3: Verify the CLI runs**

```bash
node dist/cli.mjs --help
```

Expected: prints help text with all commands (auth, podcast, tts, explainer, slides, image, music, lyrics, speakers, creation).

- [ ] **Step 4: Verify the CLI is executable**

```bash
chmod +x dist/cli.mjs
./dist/cli.mjs --help
```

Expected: same help output as Step 3.

- [ ] **Step 5: Troubleshoot if build fails**

If `vp pack` fails or the bundle errors at runtime:

1. **Node built-in import errors**: `platform: 'node'` in vite.config.ts should handle this. If specific packages aren't externalized, add them explicitly:

```ts
pack: {
  entry: ['source/cli.ts'],
  platform: 'node',
  format: ['esm'],
  external: ['open'],  // if needed
},
```

2. **Dynamic import issues**: The `await import('open')` in `source/auth/auth.ts` should be preserved by the bundler since it's a package import (not a relative path). If not, add `open` to externals.

3. **`.js` extension imports**: tsdown resolves `.js` → `.ts` automatically for bundling. No changes needed to source imports.

After any vite.config.ts changes to fix build issues, amend the vite.config.ts commit or create a fix commit.

---

### Task 8: Run formatter and lint, fix issues

**Files:** (modifies all source files via auto-format)

- [ ] **Step 1: Run oxfmt to reformat all source files**

```bash
pnpm fmt
```

Expected: reformats all `.ts` files to oxfmt style. This is a one-time diff.

- [ ] **Step 2: Run lint with auto-fix**

```bash
pnpm lint:fix
```

Expected: oxlint fixes what it can automatically.

- [ ] **Step 3: Check for remaining lint errors**

```bash
pnpm lint
```

If there are remaining errors, fix them manually. Common issues:

- Unused variables: remove or prefix with `_`
- Missing return types: add explicit return type annotations
- Any `throw` of non-Error objects: wrap in `new Error()`

- [ ] **Step 4: Commit the formatting + lint fixes**

```bash
git add -A
git commit -m "style: reformat codebase with oxfmt and fix oxlint issues"
```

---

### Task 9: Run full static check and quality gate

**Files:** (no changes expected — verification only)

- [ ] **Step 1: Run vp check (fmt + lint + type checks)**

```bash
pnpm check
```

Expected: all pass (0 errors). If type errors appear:

1. **`@sindresorhus/tsconfig` incompatibility**: If vp check's tsgolint doesn't support certain tsconfig options from the preset, simplify tsconfig.json by removing `extends` and adding strict flags manually:

```json
{
  "compilerOptions": {
    "strict": true,
    "rootDir": "source",
    "types": ["node"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "esnext"
  },
  "include": ["source"]
}
```

Then remove `@sindresorhus/tsconfig` from devDependencies and re-run `pnpm install`.

2. **Type errors in source**: Fix them. These are real issues that tsc may have been lenient about.

- [ ] **Step 2: Run the full quality gate**

```bash
pnpm ready
```

Expected: passes (check + test both succeed). `vp test run` will pass with 0 test suites since no test files exist yet.

- [ ] **Step 3: Run the CLI end-to-end**

```bash
node dist/cli.mjs --version
node dist/cli.mjs --help
node dist/cli.mjs podcast list --help
```

Expected: version prints `0.1.0`, help lists all commands, subcommand help shows options.

- [ ] **Step 4: Commit any fixes from this step**

If any source changes were needed to pass checks:

```bash
git add -A
git commit -m "fix: resolve type/lint errors from vp check"
```

---

### Task 10: SDK — upgrade vite-plus

**Files:**

- Modify: `~/coding/marswave/listenhub-sdk/package.json`

This task operates in the **listenhub-sdk** repo, not the CLI worktree. A separate worktree for SDK is not needed — this is a single-line dep bump.

- [ ] **Step 1: Update vite-plus version in SDK**

In `~/coding/marswave/listenhub-sdk/package.json`, change:

```json
"vite-plus": "^0.1.14"
```

To:

```json
"vite-plus": "^0.1.18"
```

- [ ] **Step 2: Install and verify**

```bash
cd ~/coding/marswave/listenhub-sdk
pnpm install
pnpm build
pnpm test
```

Expected: build produces `dist/index.mjs` + types, all tests pass.

- [ ] **Step 3: Run check**

```bash
pnpm check
```

Expected: passes. If the new vite-plus version introduces new lint rules that flag existing code, fix them.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: upgrade vite-plus to ^0.1.18"
```

Note: this commit goes into the SDK repo directly on main (single dep bump, no feature branch needed). If the team prefers a PR, create a branch first.

---

### Task 11: Final verification and PR

**Files:** (no changes — verification and PR creation)

Switch back to the CLI worktree for this task.

- [ ] **Step 1: Run the full quality gate one more time**

```bash
cd ~/coding/marswave/listenhub-cli/.worktrees/listenhub-cli--60
pnpm ready
```

Expected: all pass.

- [ ] **Step 2: Verify build output**

```bash
pnpm build
node dist/cli.mjs --help
```

Expected: clean build, help displays all commands.

- [ ] **Step 3: Push branch and create PR**

```bash
git push -u origin ralph/listenhub-cli--60
```

Create PR in listenhub-cli repo:

```bash
gh pr create \
  --repo marswaveai/listenhub-cli \
  --title "chore: migrate toolchain to vite-plus" \
  --body "$(cat <<'EOF'
## Summary

- Migrate build from tsc to `vp pack` (tsdown), outputting single-file bundle `dist/cli.mjs`
- Replace xo (ESLint+Prettier) with `vp lint` (oxlint) + `vp fmt` (oxfmt)
- Add vitest skeleton via `vp test`
- Unify static checks under `vp check` (fmt + lint + type checks)
- Downgrade TypeScript to 5.9.x for vite-plus peer compatibility
- Add `ready` script as quality gate (`vp check && vp test run`)
- Add `vite.config.ts` centralizing pack/lint config

Part of marswaveai/listenhub-ralph#60

## Test plan

- [ ] `pnpm build` produces `dist/cli.mjs`
- [ ] `node dist/cli.mjs --help` prints all commands
- [ ] `pnpm check` passes (fmt + lint + type checks)
- [ ] `pnpm ready` passes (check + test)
- [ ] `listenhub auth login` + `listenhub podcast list` works end-to-end
EOF
)"
```

- [ ] **Step 4: Add label to issue**

```bash
gh issue edit 60 --repo marswaveai/listenhub-ralph --add-label "needs-review"
```
