import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Idempotently writes a marker-delimited block into a file vastx-native
 * shares with a project's own hand-authored content (App_Resources/
 * Android/app.gradle, currently the only real user of this) — reruns
 * replace only vastx-native's own section between the markers, never
 * anything else the file has. If the file doesn't have this marker yet
 * (a fresh file, or a project's own pre-existing app.gradle vastx-native
 * has never touched), the block is appended rather than assumed to own
 * the whole file.
 *
 * Originally written inline in cli/lib/app-version.mjs; factored out once
 * cli/lib/websocket-setup.mjs needed the exact same "coexist with another
 * managed block, and with the project's own content, in the same file"
 * behavior — confirmed safe for multiple independent callers to use on
 * the same file, since each only looks for and touches its own marker
 * name.
 */
export function ensureMarkedBlock(path, marker, block) {
  const startMarker = `// vastx-native: ${marker} — see vastx-native's docs`
  const endMarker = `// vastx-native: end ${marker}`
  const fullBlock = `${startMarker}\n${block.trim()}\n${endMarker}\n`

  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, fullBlock)
    return
  }

  // Written in the file's own line endings, and only when something changed:
  // a Windows checkout has CRLF (git's autocrlf), and rewriting it with LF on
  // every build left a whitespace-only diff on app.gradle after each one.
  const content = readFileSync(path, 'utf8')
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const blockInEol = fullBlock.replace(/\n/g, eol)
  const startIdx = content.indexOf(startMarker)
  const endIdx = content.indexOf(endMarker)
  let updated
  if (startIdx !== -1 && endIdx !== -1) {
    const before = content.slice(0, startIdx)
    const after = content.slice(endIdx + endMarker.length)
    updated = before + blockInEol.trimEnd() + after
  } else {
    updated = content.trimEnd() + eol + eol + blockInEol
  }
  if (updated !== content) writeFileSync(path, updated)
}
