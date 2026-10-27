import { run } from '../lib/run.mjs'

/** Thin pass-through to the real `ns clean` (removes `platforms/`, `hooks/`,
 * and cached native build artifacts) — same reasoning as build.mjs/dev.mjs:
 * NativeScript already implements this correctly, no need to duplicate it. */
export async function clean() {
  console.log('[vastx-native] ns clean (removes platforms/, hooks/, and cached native build artifacts) ...')
  await run('npx', ['--yes', 'nativescript', 'clean'])
}
