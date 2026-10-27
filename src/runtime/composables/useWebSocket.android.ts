import { onUnmounted, ref, type Ref } from 'vue'

/**
 * NativeScript has no global `WebSocket` (confirmed directly on a real
 * device this session — `typeof WebSocket` is `"undefined"`), and
 * @nativescript/core's own HTTP module uses its own native widget
 * (org.nativescript.widgets.Async.Http.MakeRequest, confirmed by reading
 * its Android implementation directly), not OkHttp — so OkHttp isn't on
 * the classpath just from depending on core. `vastx-native init` adds it
 * as a real Gradle dependency (see cli/lib/websocket-setup.mjs), and this
 * talks to its real, stable WebSocket API directly via NativeScript's
 * Java interop — `SomeJavaClass.extend({...})` to subclass an abstract
 * Java class from JS, confirmed as the real, standard NativeScript
 * pattern by reading three independent real usages in @nativescript/
 * core's own source (ui/frame/activity.android.js, fragment.android.js,
 * index.android.js) before writing this.
 *
 * Import this WITHOUT a `.js` suffix — `import { useWebSocket } from
 * 'vastx-native/runtime/composables/useWebSocket'`, unlike every other
 * composable in this framework (which use an explicit `.js` suffix).
 * This is the first platform-split composable (`.android.ts`/`.ios.ts`,
 * the same convention @nativescript/core itself uses), and confirmed
 * directly via a real webpack compile that the two resolution mechanisms
 * involved don't compose the way you'd expect: `vastx-native`'s package.json
 * `"./runtime/*"` export is a wildcard needing an exact target file, so an
 * explicit `.js` suffix gets resolved *before* webpack's own platform-
 * extension list (`.android.js`/`.ios.js`/`.js`, confirmed in
 * @nativescript/webpack's own config) ever gets a chance to run — it
 * fails with "no valid target file was found" since no bare
 * `useWebSocket.js` exists, only the two platform variants. Dropping the
 * suffix lets webpack apply its own extension resolution to the
 * wildcard-substituted path instead, which correctly picks the right
 * platform file — reproduced both ways with a real compile before
 * settling on this.
 */

export interface UseWebSocketOptions {
  onOpen?: () => void
  onMessage?: (data: string) => void
  onClose?: (code: number, reason: string) => void
  onError?: (message: string) => void
}

export interface WebSocketHandle {
  connected: Ref<boolean>
  lastMessage: Ref<string | null>
  send: (data: string) => void
  close: (code?: number, reason?: string) => void
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}): WebSocketHandle {
  const connected = ref(false)
  const lastMessage = ref<string | null>(null)

  const client = new okhttp3.OkHttpClient.Builder().build()
  const request = new okhttp3.Request.Builder().url(url).build()

  const Listener = okhttp3.WebSocketListener.extend({
    init() {
      // required by NativeScript's .extend() convention even with nothing to do
    },
    onOpen(_socket: any, _response: any) {
      connected.value = true
      options.onOpen?.()
    },
    onMessage(_socket: any, text: string) {
      lastMessage.value = text
      options.onMessage?.(text)
    },
    onClosing(socket: any, code: number, reason: string) {
      socket.close(code, reason)
    },
    onClosed(_socket: any, code: number, reason: string) {
      connected.value = false
      options.onClose?.(code, reason)
    },
    onFailure(_socket: any, throwable: any, _response: any) {
      connected.value = false
      options.onError?.(throwable?.getMessage?.() ?? String(throwable))
    }
  })

  const socket = client.newWebSocket(request, new Listener())

  function send(data: string) {
    socket.send(data)
  }

  function close(code = 1000, reason = 'closed by client') {
    socket.close(code, reason)
    client.dispatcher().executorService().shutdown()
  }

  onUnmounted(() => close())

  return { connected, lastMessage, send, close }
}
