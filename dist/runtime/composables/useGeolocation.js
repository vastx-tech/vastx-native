export function useGeolocation() {
  async function requestPermission() {
    const geolocation = await loadPlugin();
    try {
      await geolocation.enableLocationRequest();
      return true;
    } catch {
      return false;
    }
  }
  async function getCurrentPosition(options = {}) {
    const geolocation = await loadPlugin();
    const { CoreTypes } = await import("@nativescript/core");
    try {
      await geolocation.enableLocationRequest();
    } catch {
      throw new Error("[vastx-native] Location permission was denied.");
    }
    const position = await geolocation.getCurrentLocation({
      desiredAccuracy: options.accuracy === "high" ? CoreTypes.Accuracy.high : CoreTypes.Accuracy.any,
      timeout: options.timeout ?? 2e4
    });
    return {
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude ?? null,
      accuracy: position.horizontalAccuracy,
      timestamp: position.timestamp?.getTime() ?? Date.now()
    };
  }
  return { requestPermission, getCurrentPosition };
}
async function loadPlugin() {
  try {
    return await import("@nativescript/geolocation");
  } catch {
    throw new Error(
      '[vastx-native] useGeolocation() requires the "@nativescript/geolocation" plugin.\nInstall it with: npm install @nativescript/geolocation'
    );
  }
}
