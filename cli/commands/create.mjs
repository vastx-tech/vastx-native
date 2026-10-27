import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  appVue,
  gitignore,
  indexPage,
  nativeIndexPage,
  nuxtConfig,
  packageJson,
  projectReadme,
  tsconfig
} from '../lib/scaffold-templates.mjs'
import { run } from '../lib/run.mjs'
import { init } from './init.mjs'
import { stylingGuide, stylingAgentInstructions } from '../lib/styling-guide.mjs'

/**
 * The one-command "ready to run on device" path: scaffolds a new Nuxt +
 * VastX Native project, installs its dependencies, and wires up the native
 * platforms — everything `vastx-native init` does, plus the project itself.
 *
 * There is no npm lifecycle hook that safely does this from `npm install
 * vastx-native` alone: a package writing files into a consumer's project as
 * an install side effect is exactly the postinstall-script pattern the npm
 * ecosystem (and CI systems that run with --ignore-scripts) treats as a red
 * flag. A `create` command that the user explicitly invokes is the same
 * pattern `create-react-app`/`create-expo-app`/`create-vite` use for the
 * same reason.
 *
 * `link`, when given, points at a local vastx-native checkout on disk
 * instead of depending on `github:vastx-tech/vastx-native` — the generated
 * project's dependency becomes a `file:` spec (npm symlinks it). Both paths
 * use the prebuilt dist committed with a release, so neither needs to
 * compile the framework during installation.
 */
export async function create(name, { appId, platforms, link, styling = 'native' } = {}) {
  if (!name) {
    throw new Error('[vastx-native] Usage: vastx-native create <project-name> [--app-id com.example.app] [--platforms ios,android] [--link /path/to/vastx-native]')
  }
  if (!['native', 'tailwind'].includes(styling)) {
    throw new Error('[vastx-native] --styling must be native or tailwind')
  }

  const targetDir = resolve(process.cwd(), name)
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new Error(`[vastx-native] ${targetDir} already exists and is not empty.`)
  }

  const resolvedAppId = appId ?? `com.example.${name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'}`
  const resolvedPlatforms = platforms?.length ? platforms : ['ios', 'android']
  const linkPath = link ? resolve(process.cwd(), link).replace(/\\/g, '/') : undefined
  const dependencySpec = linkPath ? `file:${linkPath}` : undefined

  if (linkPath && !existsSync(resolve(linkPath, 'package.json'))) {
    throw new Error(`[vastx-native] --link ${link} doesn't look like a vastx-native checkout (no package.json at ${linkPath}).`)
  }

  console.log(`[vastx-native] Scaffolding ${name}/ ...`)
  scaffold(targetDir, { appId: resolvedAppId, appName: name, dependencySpec, styling })

  console.log('[vastx-native] Installing dependencies (this pulls Nuxt, vastx-native, and NativeScript) ...')
  if (linkPath) {
    console.log(`[vastx-native] Linking vastx-native to local checkout: ${linkPath}`)
  }
  await run('npm', ['install'], { cwd: targetDir })

  // init() operates on process.cwd() (it reads nuxt.config.ts and shells to
  // `ns` relative to it) — switch into the new project the same way a user
  // would `cd` into it before running `vastx-native init` themselves.
  process.chdir(targetDir)
  await init({ platforms: resolvedPlatforms })

  console.log(`
[vastx-native] ${name} is ready. Next:
  cd ${name}
  npx vastx-native dev ${resolvedPlatforms[0]}
`)
}

function scaffold(targetDir, { appId, appName, dependencySpec, styling }) {
  mkdirSync(resolve(targetDir, 'app/pages'), { recursive: true })

  writeFileSync(resolve(targetDir, 'package.json'), packageJson(appName, dependencySpec, styling))
  writeFileSync(resolve(targetDir, 'README.md'), projectReadme(styling))
  if (styling === 'tailwind') {
    writeFileSync(resolve(targetDir, 'STYLING.md'), stylingGuide())
    writeFileSync(resolve(targetDir, 'AGENTS.md'), stylingAgentInstructions())
  }
  writeFileSync(resolve(targetDir, 'nuxt.config.ts'), nuxtConfig(appId, appName, styling))
  writeFileSync(resolve(targetDir, 'tsconfig.json'), tsconfig())
  writeFileSync(resolve(targetDir, '.gitignore'), gitignore())
  writeFileSync(resolve(targetDir, 'app/app.vue'), appVue())
  // tailwind.config.cjs/postcss.config.cjs/app/app.css are written by
  // ensureTailwindSetup() inside init(), which create() calls below —
  // one place for both create's fresh-scaffold path and init's
  // retrofit-an-existing-project path, instead of duplicating this here.
  writeFileSync(resolve(targetDir, 'app/pages/index.vue'), styling === 'tailwind' ? indexPage() : nativeIndexPage())
}
