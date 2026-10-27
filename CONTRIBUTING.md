# Contributing

Read [ARCHITECTURE.md](./ARCHITECTURE.md) first — it lists exactly what's
implemented, what's untested, and what's genuinely missing. That status
table is the most current source of truth for where help is needed; if it's
out of date after you land a change, update it in the same PR.

## Local setup

```bash
npm install
npm run dev:prepare   # builds the module in stub mode + prepares the playground
npm run dev           # runs the playground through Nuxt (module DX / typecheck only —
                       # see ARCHITECTURE.md on why this doesn't render native UI)
```

### Windows: "Cannot find native binding" (rolldown)

If `npm run dev:prepare`/`npm run dev` fails with `Cannot find native binding`
pointing at `rolldown`, it's a known npm optional-dependency resolution bug
([npm/cli#4828](https://github.com/npm/cli/issues/4828)) that sometimes
drops the platform-specific binding on Windows. Fix it locally with:

```bash
npm install @rolldown/binding-win32-x64-msvc --no-save
```

Don't commit that dependency — it's a machine-specific workaround, not a
project dependency (`--no-save` keeps it out of package.json).

Testing an actual native build currently requires the NativeScript CLI
toolchain (Xcode for iOS, Android Studio/SDK for Android) set up locally —
see the [NativeScript environment setup docs](https://docs.nativescript.org/environment-setup).
This has not been exercised end-to-end yet; if you get further than
ARCHITECTURE.md's status table implies, that's valuable signal — please
open an issue with what broke.

## Before opening a PR

- `npm run lint`
- `npm run typecheck`
- `npm run test`

## Preparing a distribution

GitHub installs use the committed `dist/` files. After changing `src/`, run
`npm run release:build` and include the resulting `dist/` changes in the same
commit. `npm pack --dry-run` checks the package contents without rebuilding.
The `prepublishOnly` script rebuilds automatically for an npm registry release;
do not add `prepare`, `prepack`, or a `build` script, because npm runs those
when installing a Git dependency.

## Releasing

Add a line to `CHANGELOG.md` under "Unreleased" in the same PR as each change
users will notice. Anything that behaves differently for existing apps goes
under "Changed". Then, from an up-to-date `main`:

```bash
npm run release -- minor --dry-run   # checks only; or patch / major / 2.2.0
npm run release -- minor
```

The script stops if you're not on `main`, have uncommitted changes, aren't in
sync with `origin/main`, the tag already exists, or "Unreleased" is empty. It
runs the tests, lint and `release:build`, sets the version in package.json, moves
"Unreleased" to a dated heading, then commits `Release vX.Y.Z` (with any rebuilt
`dist/`), tags it, pushes, and creates the GitHub Release from the changelog. It
needs the GitHub CLI (`gh`), signed in.

Add `--npm` to also publish to the npm registry (`npm login` first). The
script checks the login and that the version isn't on npm yet before it
changes anything.

The tag matters beyond GitHub: `create` pins new projects to
`github:vastx-tech/vastx-native#v<version in package.json>`, so every version in
package.json on `main` must have a tag. Only change the version through the
release script.
