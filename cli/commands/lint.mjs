import { extname, join } from 'node:path'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { scanPages } from '../lib/scan-pages.mjs'

const NAVIGATE_CALL = /\bnavigate\(\s*['"]([^'"]+)['"]/g

/**
 * A structural check regular ESLint can't do: it doesn't know what a
 * "route name" is in this framework, so a typo'd `navigate('detials_id')`
 * type-checks fine and only fails at runtime, on-device, mid-navigation.
 * This cross-references every `navigate('name')` call under `app/`
 * against the same real route manifest `useNativeRouter()` reads from
 * (via the identical scan-pages.mjs used by `init`/`dev`/`build`), so
 * "route doesn't exist" is caught before a build, not during one.
 */
export async function lint({ appDir = 'app', pagesDir = 'app/pages' } = {}) {
  const root = process.cwd()
  const routes = scanPages(join(root, pagesDir))
  const routeNames = new Set(routes.map(route => route.name))

  const files = walkFiles(join(root, appDir), ['.vue', '.ts'])
  const problems = []

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const match of content.matchAll(NAVIGATE_CALL)) {
      const routeName = match[1]
      if (!routeNames.has(routeName)) {
        problems.push({ file, routeName })
      }
    }
  }

  const knownRoutes = [...routeNames].join(', ')

  if (problems.length === 0) {
    console.log(`[vastx-native] lint: OK — every navigate() call matches a real route.`)
    console.log(`[vastx-native] Routes: ${knownRoutes}`)
    return
  }

  console.log(`[vastx-native] lint: ${problems.length} navigate() call(s) reference a route that doesn't exist:\n`)
  for (const { file, routeName } of problems) {
    console.log(`  ${file}`)
    console.log(`    navigate('${routeName}') — no route named "${routeName}"`)
  }
  console.log(`\n[vastx-native] Known routes: ${knownRoutes}`)
  process.exitCode = 1
}

function walkFiles(dir, extensions) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) results.push(...walkFiles(full, extensions))
    else if (extensions.includes(extname(full))) results.push(full)
  }
  return results
}
