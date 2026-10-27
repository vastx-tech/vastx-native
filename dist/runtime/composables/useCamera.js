export function useCamera() {
  async function requestPermission() {
    const camera = await loadPlugin();
    const result = await camera.requestPermissions();
    return result.Success;
  }
  async function takePicture(options = {}) {
    const camera = await loadPlugin();
    const granted = await requestPermission();
    if (!granted) {
      throw new Error("[vastx-native] Camera permission was denied.");
    }
    const asset = await camera.takePicture({
      width: options.width,
      height: options.height,
      keepAspectRatio: options.keepAspectRatio ?? true,
      saveToGallery: options.saveToGallery ?? false,
      cameraFacing: options.cameraFacing ?? "rear"
    });
    return { asset };
  }
  return { requestPermission, takePicture };
}
async function loadPlugin() {
  try {
    return await import("@nativescript/camera");
  } catch {
    throw new Error(
      '[vastx-native] useCamera() requires the "@nativescript/camera" plugin.\nInstall it with: npm install @nativescript/camera'
    );
  }
}
