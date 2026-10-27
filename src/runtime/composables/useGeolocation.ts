export interface GeoPosition {
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number
  timestamp: number
}

export type GeoAccuracy = 'high' | 'any'

export interface GetLocationOptions {
  accuracy?: GeoAccuracy
  /** Milliseconds before giving up. */
  timeout?: number
}

/**
 * Wraps the `@nativescript/geolocation` plugin. It's a peer plugin rather
 * than a bundled dependency — most apps that don't need location shouldn't
 * pay for the native permission prompts/entitlements it requires.
 */
export function useGeolocation() {
  async function requestPermission(): Promise<boolean> {
    const geolocation = await loadPlugin()
    // enableLocationRequest() resolves to undefined on success and REJECTS
    // (does not resolve false) if the user denies the permission — there is
    // no truthy/falsy "granted" value to check.
    try {
      await geolocation.enableLocationRequest()
      return true
    } catch {
      return false
    }
  }

  async function getCurrentPosition(options: GetLocationOptions = {}): Promise<GeoPosition> {
    const geolocation = await loadPlugin()
    const { CoreTypes } = await import('@nativescript/core')

    try {
      await geolocation.enableLocationRequest()
    } catch {
      throw new Error('[vastx-native] Location permission was denied.')
    }

    const position = await geolocation.getCurrentLocation({
      desiredAccuracy: options.accuracy === 'high' ? CoreTypes.Accuracy.high : CoreTypes.Accuracy.any,
      timeout: options.timeout ?? 20000
    })

    return {
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude ?? null,
      accuracy: position.horizontalAccuracy,
      timestamp: position.timestamp?.getTime() ?? Date.now()
    }
  }

  return { requestPermission, getCurrentPosition }
}

async function loadPlugin() {
  try {
    return await import('@nativescript/geolocation')
  } catch {
    throw new Error(
      '[vastx-native] useGeolocation() requires the "@nativescript/geolocation" plugin.\n'
      + 'Install it with: npm install @nativescript/geolocation'
    )
  }
}
