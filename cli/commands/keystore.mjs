import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { run } from '../lib/run.mjs'

/**
 * Generates an Android release-signing keystore via `keytool` (ships with
 * any JDK — not reimplemented here). Never persists the password anywhere:
 * that's a real secret, and a local config file is exactly the kind of
 * thing that ends up committed by accident. Instead this prints the
 * VASTX_NATIVE_KEYSTORE_* environment variable names `build.mjs` already
 * knows to read, so the workflow is "set them once in your shell profile
 * or CI secrets, then just run `vastx-native build android --release`" —
 * no flags to retype, nothing sensitive on disk.
 */
export async function keystoreCreate({ alias, output, validityDays = 10000 } = {}) {
  if (!alias) {
    throw new Error('[vastx-native] Usage: vastx-native keystore create --alias <name> [--output ./release.keystore] [--validity 10000]')
  }

  const outputPath = resolve(process.cwd(), output ?? 'release.keystore')
  if (existsSync(outputPath)) {
    throw new Error(`[vastx-native] ${outputPath} already exists — refusing to overwrite an existing keystore (doing so would break your ability to publish updates to any app already signed with it).`)
  }

  console.log(`[vastx-native] Generating a keystore at ${outputPath} ...`)
  console.log('[vastx-native] keytool will prompt for a keystore password and some identity questions (org, name, ...) — vastx-native never sees or stores the password.')

  await run('keytool', [
    '-genkeypair', '-v',
    '-keystore', outputPath,
    '-alias', alias,
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', String(validityDays)
  ])

  // keytool exits 0 even when it completely fails — e.g. its interactive
  // password prompts failing (mismatched confirmation, too-short password)
  // under non-interactive/piped stdin print "Too many failures - try
  // later" and still return exit code 0, reproduced directly. `run()`'s
  // exit-code check can't catch this, so the actual output file's
  // existence is the only reliable success signal here.
  if (!existsSync(outputPath)) {
    throw new Error(`[vastx-native] keytool reported success but ${outputPath} was never created — it likely failed at an interactive prompt (e.g. a mismatched or too-short password). Try running \`vastx-native keystore create\` again from a real interactive terminal.`)
  }

  console.log(`
[vastx-native] Keystore created at ${outputPath}.

IMPORTANT: back this file up somewhere safe, outside version control —
losing it means you can never publish an update to an app already signed
with it.

Build a signed release either by passing the flags directly:
  vastx-native build android --release \\
    --key-store-path ${outputPath} --key-store-password <password> \\
    --key-store-alias ${alias} --key-store-alias-password <password>

...or set these once (shell profile, CI secrets) and just run
\`vastx-native build android --release\` — it reads them automatically:
  VASTX_NATIVE_KEYSTORE_PATH=${outputPath}
  VASTX_NATIVE_KEYSTORE_PASSWORD=<password>
  VASTX_NATIVE_KEYSTORE_ALIAS=${alias}
  VASTX_NATIVE_KEYSTORE_ALIAS_PASSWORD=<password>
`)
}
