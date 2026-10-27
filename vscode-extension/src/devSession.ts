import * as vscode from 'vscode'

export type DevSessionState = 'stopped' | 'running'

/**
 * Runs `vastx-native dev <platform>` inside a real VS Code integrated
 * terminal — not a headless spawned child process. This isn't a stylistic
 * choice: `ns run`'s hot-restart/force-restart/toggle-watcher key commands
 * only work over a real TTY (confirmed by reading
 * key-command-helper.js — `attachKeyCommands` calls `stdin.setRawMode`,
 * and explicitly falls back to an IPC `process.on('message')` listener
 * when that's unavailable, which a plain `child_process.spawn` with piped
 * stdio never wires up). VS Code's `Terminal.sendText()` writes into a
 * genuinely pty-backed terminal, so the same keypress handling that works
 * when a developer runs `ns run` by hand in a real terminal works
 * identically here.
 */
export class DevSession {
  private terminal: vscode.Terminal | null = null
  private readonly onStateChangeEmitter = new vscode.EventEmitter<DevSessionState>()
  readonly onStateChange = this.onStateChangeEmitter.event

  constructor(private readonly cwd: string) {
    vscode.window.onDidCloseTerminal((closed) => {
      if (closed === this.terminal) {
        this.terminal = null
        this.onStateChangeEmitter.fire('stopped')
      }
    })
  }

  getState(): DevSessionState {
    return this.terminal ? 'running' : 'stopped'
  }

  start(platform: 'ios' | 'android', deviceId?: string): void {
    if (this.terminal) {
      throw new Error('A dev session is already running — stop it first.')
    }

    this.terminal = vscode.window.createTerminal({ name: 'VastX Native', cwd: this.cwd })
    this.terminal.show()

    const deviceArgs = deviceId ? ` --device ${deviceId}` : ''
    this.terminal.sendText(`npx vastx-native dev ${platform}${deviceArgs}`, true)
    this.onStateChangeEmitter.fire('running')
  }

  /** Rebuilds only if needed, then restarts the app on-device. */
  hotRestart(): void {
    this.sendKey('r')
  }

  /** Always rebuilds the native app, then restarts — for changes a hot
   * restart alone won't pick up (native dependencies, App_Resources). */
  forceRestart(): void {
    this.sendKey('R')
  }

  /** Pauses/resumes the file watcher — while paused, saving a file
   * doesn't trigger hot reload at all. Same key toggles both ways. */
  toggleWatcher(): void {
    this.sendKey('w')
  }

  stop(): void {
    if (!this.terminal) return
    // Ctrl+C is what ns run's own key-command handler listens for to quit
    // cleanly (its CtrlC handler calls process.exit()) — more reliable
    // than disposing the terminal outright, which would send SIGHUP/SIGTERM
    // to whatever native subprocesses (gradle, adb, xcodebuild) it spawned,
    // not necessarily letting them wind down cleanly.
    this.terminal.sendText('\x03', false)
  }

  private sendKey(key: string): void {
    if (!this.terminal) {
      throw new Error('No dev session is running — start one first.')
    }
    // addNewLine: false — ns run's key commands are raw single-keypresses,
    // not lines; a trailing newline would change what string it receives
    // and the exact-match lookup against its registered command keys
    // would fail (confirmed in key-command-helper.js: it string-compares
    // the whole received chunk, so "r\n" would not match "r").
    this.terminal.sendText(key, false)
  }
}
