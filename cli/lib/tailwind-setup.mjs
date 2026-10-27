import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { appCss, postcssConfig, tailwindConfig } from './scaffold-templates.mjs'
import { stylingGuide, stylingAgentInstructions } from './styling-guide.mjs'
import { run } from './run.mjs'

/**
 * Sets up the explicit Tailwind v3 + NativeScript PostCSS pipeline. Only
 * untouched legacy generated configs are migrated (with a backup); custom
 * configs, source styles, and existing agent instructions are preserved.
 * Called by init/dev/build as well as fresh project creation.
 */
export async function ensureTailwindSetup(projectRoot) {
  const requireFromProject = createRequire(join(projectRoot, 'package.json'))
  if (isResolvable('tailwindcss/package.json', projectRoot)) {
    const { version } = JSON.parse(readFileSync(requireFromProject.resolve('tailwindcss/package.json'), 'utf8'))
    if (!version.startsWith('3.')) {
      throw new Error('[vastx-native] This integration requires Tailwind v3. Run npm install -D tailwindcss@^3.4.19. Tailwind v4 needs a different pipeline; your config has not been changed.')
    }
  }

  const missing = ['tailwindcss@^3.4.19', 'postcss@^8.5.28']
    .filter(spec => !isResolvable(spec.split('@')[0], projectRoot))
  if (missing.length) {
    console.log(`[vastx-native] Installing styling dependencies: ${missing.join(', ')}`)
    await run('npm', ['install', '--save-dev', ...missing], { cwd: projectRoot })
  }

  if (!findConfig(projectRoot, 'tailwind')) writeIfMissing(join(projectRoot, 'tailwind.config.cjs'), tailwindConfig())
  writeIfMissing(join(projectRoot, 'app/app.css'), appCss())
  writeIfMissing(join(projectRoot, 'STYLING.md'), stylingGuide())
  writeIfMissing(join(projectRoot, 'AGENTS.md'), stylingAgentInstructions())

  const configPath = findConfig(projectRoot, 'postcss') ?? join(projectRoot, 'postcss.config.cjs')
  if (!existsSync(configPath)) {
    writeFileSync(configPath, postcssConfig())
  } else {
    const source = readFileSync(configPath, 'utf8')
    // Only migrate the original generated config. Preserve custom pipelines.
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').trim()
    if (/^module\.exports\s*=\s*\{\s*plugins:\s*\[\s*require\(['"]tailwindcss['"]\)\s*\]\s*(?:,\s*)?\}\s*;?$/.test(withoutComments)) {
      const backup = `${configPath}.before-native-tailwind`
      if (!existsSync(backup)) copyFileSync(configPath, backup)
      writeFileSync(configPath, postcssConfig())
      console.log(`[vastx-native] Upgraded generated PostCSS config (backup: ${backup})`)
    } else if (!source.includes('vastx-native/cli/lib/native-tailwind.cjs')) {
      console.warn(`[vastx-native] Custom PostCSS config preserved: ${configPath}. Add require('vastx-native/cli/lib/native-tailwind.cjs')() after Tailwind for native units. See STYLING.md.`)
    }
  }
}

function findConfig(root, name) {
  const extensions = ['cjs', 'js', 'mjs', 'ts', 'cts', 'mts']
  const candidates = extensions.map(ext => `${name}.config.${ext}`)
  if (name === 'postcss') {
    candidates.push('.postcssrc', ...[...extensions, 'json', 'yaml', 'yml'].map(ext => `.postcssrc.${ext}`))
    const packagePath = join(root, 'package.json')
    if (existsSync(packagePath) && JSON.parse(readFileSync(packagePath, 'utf8')).postcss) return packagePath
  }
  return candidates.map(path => join(root, path)).find(path => existsSync(path))
}

function isResolvable(specifier, projectRoot) {
  try {
    createRequire(join(projectRoot, 'package.json')).resolve(specifier)
    return true
  } catch {
    return false
  }
}

function writeIfMissing(path, contents) {
  if (existsSync(path)) return
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents)
}
