import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { run } from '../lib/run.mjs'

/**
 * Checks a project against every real bug this framework has actually hit
 * and fixed so far (missing typescript dependency, "type": "module"
 * poisoning vendored CommonJS tooling, a webpack.config.cjs that never got
 * generated, ...) — the class of problem `ns`'s own environment checks
 * (Xcode/Android SDK/JDK) can't see, since they're specific to how
 * vastx-native wires a project together, not the machine it runs on.
 * Delegates the machine-level checks to the real `ns info` afterward
 * rather than re-implementing them.
 */
export async function doctor() {
  const root = process.cwd()
  const checks = []

  const pkgPath = join(root, 'package.json')
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : {}
  checks.push(check('package.json exists', existsSync(pkgPath), 'Not a VastX Native project directory? Run: vastx-native create <name>'))

  if (existsSync(pkgPath)) {
    checks.push(check(
      'package.json does not set "type": "module"',
      pkg.type !== 'module',
      'NativeScript\'s own vendored build tooling under platforms/ ships plain CommonJS scripts with no package.json of their own — "type": "module" at the project root makes Node misread them as ESM and throw "require is not defined". Remove the "type" field.'
    ))

    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    checks.push(check(
      '"typescript" is a dependency',
      Boolean(deps.typescript),
      'ts-loader (used by @nativescript/webpack to compile <script lang="ts">) peer-depends on this — it\'s never installed transitively. Run: npm install -D typescript'
    ))
    checks.push(check(
      '"@nativescript/webpack" is a dependency',
      Boolean(deps['@nativescript/webpack']),
      'Required directly by `ns build`/`ns run` — without it there\'s no compiler for .vue pages at all. Run: npm install -D @nativescript/webpack'
    ))
    checks.push(check(
      '"main" field is set in package.json',
      Boolean(pkg.main),
      '@nativescript/webpack\'s getEntryPath() falls back to this if nativescript.config.ts has no `main` — with neither set, it throws ERR_INVALID_ARG_TYPE. Run: vastx-native init'
    ))
  }

  const nsConfigPath = join(root, 'nativescript.config.ts')
  const nsConfigExists = existsSync(nsConfigPath)
  checks.push(check('nativescript.config.ts exists', nsConfigExists, 'Run: vastx-native init'))

  if (nsConfigExists) {
    const nsConfig = readFileSync(nsConfigPath, 'utf8')
    checks.push(check(
      'nativescript.config.ts sets bundlerConfigPath',
      nsConfig.includes('bundlerConfigPath'),
      'Without it, `ns` looks for the default webpack.config.js, which vastx-native never generates (it generates webpack.config.cjs instead — see webpack-config.mjs for why). Run: vastx-native init'
    ))
    checks.push(check(
      'nativescript.config.ts sets webpackConfigPath (fallback)',
      nsConfig.includes('webpackConfigPath'),
      'A safety net for `ns` versions/installs that don\'t read bundlerConfigPath — a real one hit this. Run: vastx-native init'
    ))
    checks.push(check(
      'nativescript.config.ts sets main',
      /\bmain\s*:/.test(nsConfig),
      'Checked before package.json\'s own `main` field by getEntryPath() — see the package.json check above. Run: vastx-native init'
    ))
  }

  checks.push(check(
    'webpack.config.cjs exists',
    existsSync(join(root, 'webpack.config.cjs')),
    'Required by `ns build`/`ns run` to know how to compile .vue pages. Run: vastx-native init'
  ))

  const tsconfigPath = join(root, 'tsconfig.json')
  const tsconfigExists = existsSync(tsconfigPath)
  checks.push(check('tsconfig.json exists', tsconfigExists))

  if (tsconfigExists) {
    let tsconfig = {}
    try {
      tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'))
    } catch {
      checks.push(check('tsconfig.json is valid JSON', false))
    }
    checks.push(check(
      'tsconfig.json sets compilerOptions.allowJs',
      tsconfig.compilerOptions?.allowJs === true,
      'Without it, TypeScript\'s own include-glob matching finds zero root files (nothing under app/ is a bare .ts file) and ts-loader fails with TS18003 "No inputs were found".'
    ))
    checks.push(check(
      'tsconfig.json does not include nuxt.config.ts',
      !(tsconfig.include ?? []).some(p => p.includes('nuxt.config')),
      'nuxt.config.ts uses the ambient global defineNuxtConfig, which only exists via Nuxt\'s own generated types — including it here puts it in scope for ForkTsCheckerWebpackPlugin, which fails type-checking it.'
    ))
  }

  console.log('\n[vastx-native] Project checks:\n')
  for (const c of checks) printCheck(c)

  const failed = checks.filter(c => !c.ok)
  console.log(`\n[vastx-native] ${checks.length - failed.length}/${checks.length} checks passed.`)

  console.log('\n[vastx-native] Delegating to `ns info` for environment checks (Xcode, Android SDK, JDK, ...):\n')
  try {
    await run('npx', ['--yes', 'nativescript', 'info'])
  } catch {
    // `ns info` exits non-zero whenever it finds an environment problem —
    // that's its normal, correct behavior (it already printed exactly
    // what's wrong), not a failure of this command.
  }

  if (failed.length > 0) process.exitCode = 1
}

function check(label, ok, fix) {
  return { label, ok, fix }
}

function printCheck({ label, ok, fix }) {
  console.log(`  ${ok ? '✔' : '✖'} ${label}`)
  if (!ok && fix) console.log(`      ${fix}`)
}
