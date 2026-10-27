import * as vscode from 'vscode'
import type { DevSessionState } from './devSession'

/** A single status bar entry reflecting the dev session — click it for
 * quick actions instead of hunting through the Command Palette every
 * time. */
export class DevStatusBar {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)

  constructor() {
    this.item.command = 'vastxNative.statusBarClicked'
    this.setState('stopped')
    this.item.show()
  }

  setState(state: DevSessionState): void {
    if (state === 'running') {
      this.item.text = '$(sync) VastX Native: Running'
      this.item.tooltip = 'Click for hot restart / stop / more'
    } else {
      this.item.text = '$(play) VastX Native: Stopped'
      this.item.tooltip = 'Click to run on a device'
    }
  }

  dispose(): void {
    this.item.dispose()
  }
}
