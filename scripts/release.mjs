#!/usr/bin/env node
/**
 * Releases vastx-native: `npm run release -- <version|patch|minor|major> [--npm] [--dry-run]`.
 *
 * A release is a git tag (vX.Y.Z) plus a GitHub Release, so a project can
 * pin `github:vastx-tech/vastx-native#vX.Y.Z` and `create` can scaffold new
 * projects pinned to the release that created them. With --npm it's also
 * published to the npm registry.
 *
 * Steps, stopping at the first failure:
 *  1. check: on main, no uncommitted changes, up to date with origin/main,
 *     the tag doesn't exist yet, CHANGELOG.md has entries under "Unreleased"
 *  2. npm test, npm run lint, npm run release:build (dist/ is committed,
 *     since GitHub installs don't build it)
 *  3. set package.json's version and move "Unreleased" in CHANGELOG.md to
 *     a dated heading for this version
 *  4. commit "Release vX.Y.Z" (including any rebuilt dist/), tag it, push
 *     main and the tag, and create the GitHub Release from the changelog
 *  5. with --npm, `npm publish` it. Checked up front with the rest: you must
 *     be logged in (`npm login`) and the version must not be on npm yet, so
 *     a missing login can't leave a release half-done.
 *
 * --dry-run runs the checks and prints the plan without changing anything.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUMPS = ['major', 'minor', 'patch']

export function nextVersion(current, request) {
  if (!request) throw new Error('Usage: npm run release -- <version|patch|minor|major> [--dry-run]')
  if (!BUMPS.includes(request)) {
    const version = request.replace(/^v/, '')
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Not a version: ${request} (expected e.g. 2.2.0, or patch/minor/major)`)
    return version
  }
  const [major, minor, patch] = current.split('.').map(Number)
  if (request === 'major') return `${major + 1}.0.0`
  if (request === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

// Both take the changelog as it is on disk: a Windows checkout has CRLF
// line endings (git's autocrlf), which the first version of this script
// didn't match, so it reported an empty changelog.

/** The text under "## Unreleased", up to the next "## " heading. */
export function unreleasedNotes(changelog) {
  const text = changelog.replace(/\r\n/g, '\n')
  const match = /^## Unreleased[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)
  return match ? match[1].trim() : ''
}

/** Turns the Unreleased section into "## version - date", leaving an empty Unreleased above it. Keeps the file's line endings. */
export function stampChangelog(changelog, version, date) {
  const eol = changelog.includes('\r\n') ? '\r\n' : '\n'
  const heading = /^## Unreleased[ \t]*(?=\r?$)/m
  if (!heading.test(changelog)) throw new Error('CHANGELOG.md has no "## Unreleased" heading')
  return changelog.replace(heading, `## Unreleased${eol}${eol}## ${version} - ${date}`)
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function step(label, command, args) {
  console.log(`\n[release] ${label}: ${command} ${args.join(' ')}`)
  // npm is npm.cmd on Windows, which needs a shell; nothing else gets one,
  // so arguments are passed through untouched.
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: command === 'npm' && process.platform === 'win32' })
  if (result.status !== 0) throw new Error(`${label} failed`)
}

/** Runs an npm command quietly; its trimmed stdout, or '' if it failed. */
function npmQuiet(args) {
  const result = spawnSync('npm', args, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' })
  return result.status === 0 ? result.stdout.trim() : ''
}

function fail(message) {
  console.error(`\n[release] ${message}`)
  process.exit(1)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const toNpm = args.includes('--npm')
  const request = args.find(arg => !arg.startsWith('--'))

  const pkgPath = join(ROOT, 'package.json')
  const changelogPath = join(ROOT, 'CHANGELOG.md')
  const pkgText = readFileSync(pkgPath, 'utf8')
  const current = JSON.parse(pkgText).version
  const version = nextVersion(current, request)
  const tag = `v${version}`
  const changelog = readFileSync(changelogPath, 'utf8')
  const notes = unreleasedNotes(changelog)

  const problems = []
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  if (branch !== 'main') problems.push(`releases are made from main (you're on ${branch})`)
  if (git('status', '--porcelain', '--untracked-files=no')) problems.push('there are uncommitted changes')
  git('fetch', 'origin', '--tags', '--quiet')
  if (branch === 'main' && git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) problems.push('main differs from origin/main (pull or push first)')
  if (git('tag', '--list', tag)) problems.push(`tag ${tag} already exists`)
  if (!notes) problems.push('CHANGELOG.md has nothing under "## Unreleased"')
  if (toNpm) {
    if (!npmQuiet(['whoami'])) problems.push('--npm: not logged in to npm (run `npm login` first)')
    if (npmQuiet(['view', `vastx-native@${version}`, 'version']) === version) problems.push(`--npm: vastx-native@${version} is already on npm`)
  }

  console.log(`[release] ${current} -> ${version} (tag ${tag})`)
  console.log(`[release] notes:\n\n${notes || '(none)'}\n`)
  if (problems.length) fail(`can't release yet:\n  - ${problems.join('\n  - ')}`)
  if (dryRun) {
    console.log(`[release] dry run: checks passed; would test, lint, build, bump, commit, tag, push and create the GitHub Release${toNpm ? ', then publish to npm' : ''}.`)
    return
  }

  step('tests', 'npm', ['test'])
  step('lint', 'npm', ['run', 'lint'])
  // Bump before building: the build copies the version into
  // dist/module.json (2.2.0 shipped saying 2.1.0 there, built first).
  if (version !== current) writeFileSync(pkgPath, pkgText.replace(`"version": "${current}"`, `"version": "${version}"`))
  writeFileSync(changelogPath, stampChangelog(changelog, version, new Date().toISOString().slice(0, 10)))
  step('build dist', 'npm', ['run', 'release:build'])

  git('add', 'package.json', 'CHANGELOG.md', 'dist')
  git('commit', '-m', `Release ${tag}`)
  git('tag', '-a', tag, '-m', `vastx-native ${tag}`)
  step('push', 'git', ['push', 'origin', 'main', '--follow-tags'])
  const notesDir = mkdtempSync(join(tmpdir(), 'vastx-native-release-'))
  const notesFile = join(notesDir, 'notes.md')
  writeFileSync(notesFile, `${notes}\n`)
  try {
    step('GitHub Release', 'gh', ['release', 'create', tag, '--verify-tag', '--title', tag, '--notes-file', notesFile])
  } finally {
    rmSync(notesDir, { recursive: true, force: true })
  }
  if (toNpm) step('npm publish', 'npm', ['publish', '--access', 'public'])
  console.log(`\n[release] done: ${tag}. Projects can pin "vastx-native": "github:vastx-tech/vastx-native#${tag}"${toNpm ? ` or "^${version}" from npm` : ''}.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => fail(error.message))
}
