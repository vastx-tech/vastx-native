export interface CapturedImage {
  /**
   * Native ImageAsset — pass to <Image :src>, save, or upload. Its `.width`/
   * `.height` are not exposed here directly: ImageAsset only echoes back the
   * requested `options.width`/`options.height` (both optional, so possibly
   * undefined), not the resolved image's actual pixel dimensions — reading
   * those requires the asset's own `getImageAsync()`.
   */
  asset: unknown
}

export interface TakePictureOptions {
  width?: number
  height?: number
  keepAspectRatio?: boolean
  saveToGallery?: boolean
  cameraFacing?: 'front' | 'rear'
}

/**
 * Wraps the `@nativescript/camera` plugin. Kept as a peer plugin, the same
 * way useGeolocation() is — camera access pulls in its own native
 * permissions/entitlements that not every app needs.
 */
export function useCamera() {
  async function requestPermission(): Promise<boolean> {
    const camera = await loadPlugin()
    // requestPermissions() always resolves (it does not reject on denial) —
    // whether it was actually granted is in the resolved result's Success
    // field, not in whether the promise rejected.
    const result = await camera.requestPermissions()
    return result.Success
  }

  async function takePicture(options: TakePictureOptions = {}): Promise<CapturedImage> {
    const camera = await loadPlugin()
    const granted = await requestPermission()
    if (!granted) {
      throw new Error('[vastx-native] Camera permission was denied.')
    }

    const asset = await camera.takePicture({
      width: options.width,
      height: options.height,
      keepAspectRatio: options.keepAspectRatio ?? true,
      saveToGallery: options.saveToGallery ?? false,
      cameraFacing: options.cameraFacing ?? 'rear'
    })

    return { asset }
  }

  return { requestPermission, takePicture }
}

async function loadPlugin() {
  try {
    return await import('@nativescript/camera')
  } catch {
    throw new Error(
      '[vastx-native] useCamera() requires the "@nativescript/camera" plugin.\n'
      + 'Install it with: npm install @nativescript/camera'
    )
  }
}
