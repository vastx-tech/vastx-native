import { ApplicationSettings } from '@nativescript/core'

export interface PersistOptions {
  /** ApplicationSettings key. Default: `pinia:<store id>`. */
  key?: string
  /** Only save these top-level state keys. Default: all of them. */
  pick?: string[]
}

// Structural, so this file doesn't need pinia's types (pinia is an
// optional dependency of the app, not of vastx-native).
interface StoreLike {
  $id: string
  $state: Record<string, unknown>
  $patch(partial: Record<string, unknown>): void
  $subscribe(callback: (mutation: unknown, state: Record<string, unknown>) => void, options?: { detached?: boolean }): () => void
}

/**
 * Pinia plugin that saves a store's state on the device and restores it at
 * startup — opt in per store with `persist`:
 *
 *   export const useCartStore = defineStore('cart', () => { ... }, { persist: true })
 *   export const useAuthStore = defineStore('auth', { state: ..., persist: { pick: ['token'] } })
 *
 * Registered automatically by the generated app entry when pinia is
 * installed. Saved as JSON with ApplicationSettings (see useStorage), on
 * every state change, so keep persisted state small and plain.
 */
export function piniaPersist({ store, options }: { store: StoreLike, options: { persist?: boolean | PersistOptions } }) {
  if (!options.persist) return
  const { key = `pinia:${store.$id}`, pick } = options.persist === true ? {} : options.persist

  if (ApplicationSettings.hasKey(key)) {
    try {
      const saved = JSON.parse(ApplicationSettings.getString(key)) as Record<string, unknown>
      store.$patch(select(saved, pick))
    } catch {
      ApplicationSettings.remove(key) // unreadable (e.g. written by an older app version): start fresh
    }
  }

  store.$subscribe((_mutation, state) => {
    ApplicationSettings.setString(key, JSON.stringify(select(state, pick)))
  }, { detached: true })
}

function select(state: Record<string, unknown>, pick?: string[]) {
  if (!pick) return state
  return Object.fromEntries(pick.filter(name => name in state).map(name => [name, state[name]]))
}
