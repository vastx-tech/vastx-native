import * as vscode from 'vscode'
import { DevSession } from './devSession'
import { listDevices } from './devices'
import { DevStatusBar } from './statusBar'
import { getWorkspaceRoot, runInTerminal } from './workspace'

let devSession: DevSession | null = null
let statusBar: DevStatusBar | null = null
let selectedDeviceId: string | undefined

export function activate(context: vscode.ExtensionContext): void {
  statusBar = new DevStatusBar()
  context.subscriptions.push({ dispose: () => statusBar?.dispose() })

  const register = (command: string, handler: (...args: unknown[]) => unknown) => {
    context.subscriptions.push(vscode.commands.registerCommand(command, wrapErrors(handler)))
  }

  register('vastxNative.create', commandCreate)
  register('vastxNative.init', () => runInTerminal('VastX Native', getWorkspaceRoot(), 'npx vastx-native init'))
  register('vastxNative.run', commandRun)
  register('vastxNative.hotRestart', () => requireSession().hotRestart())
  register('vastxNative.forceRestart', () => requireSession().forceRestart())
  register('vastxNative.toggleWatcher', () => requireSession().toggleWatcher())
  register('vastxNative.stop', () => requireSession().stop())
  register('vastxNative.build', commandBuild)
  register('vastxNative.doctor', () => runInTerminal('VastX Native: Doctor', getWorkspaceRoot(), 'npx vastx-native doctor'))
  register('vastxNative.analyze', commandAnalyze)
  register('vastxNative.lint', () => runInTerminal('VastX Native: Lint', getWorkspaceRoot(), 'npx vastx-native lint'))
  register('vastxNative.clean', () => runInTerminal('VastX Native: Clean', getWorkspaceRoot(), 'npx vastx-native clean'))
  register('vastxNative.keystoreCreate', commandKeystoreCreate)
  register('vastxNative.selectDevice', commandSelectDevice)
  register('vastxNative.statusBarClicked', commandStatusBarClicked)
}

export function deactivate(): void {
  // Deliberately not stopping the dev session here: closing/reloading the
  // extension host (e.g. an extension host restart) shouldn't kill a
  // LiveSync session the developer is actively watching on a device.
}

function getSession(): DevSession {
  if (!devSession) {
    devSession = new DevSession(getWorkspaceRoot())
    devSession.onStateChange((state) => statusBar?.setState(state))
  }
  return devSession
}

function requireSession(): DevSession {
  const session = getSession()
  if (session.getState() === 'stopped') {
    throw new Error('No dev session is running — use "VastX Native: Run..." first.')
  }
  return session
}

async function commandCreate(): Promise<void> {
  const name = await vscode.window.showInputBox({ prompt: 'Project name', placeHolder: 'my-app' })
  if (!name) return

  const appId = await vscode.window.showInputBox({
    prompt: 'App ID (reverse-DNS)',
    placeHolder: `com.example.${name.replace(/[^a-z0-9]/gi, '').toLowerCase()}`
  })

  const platforms = await pickPlatforms()
  if (!platforms) return

  const parentDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    ?? (await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, openLabel: 'Create project here' }))?.[0]?.fsPath
  if (!parentDir) return

  const appIdFlag = appId ? ` --app-id ${appId}` : ''
  runInTerminal('VastX Native: Create', parentDir, `npx github:vastx-tech/vastx-native create ${name}${appIdFlag} --platforms ${platforms.join(',')}`)

  const openAfter = await vscode.window.showInformationMessage(
    `Creating ${name}... open it once it's done?`,
    'Open when ready'
  )
  if (openAfter) {
    // There is no reliable "command finished" signal from sendText() —
    // openFolder is a full window reload, so this is a deliberate,
    // conservative delay rather than guessing at completion from output.
    setTimeout(() => {
      void vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(`${parentDir}/${name}`))
    }, 5000)
  }
}

async function commandRun(): Promise<void> {
  const platform = await pickPlatform()
  if (!platform) return

  const deviceId = await maybePickDevice(platform)
  getSession().start(platform, deviceId)
}

async function commandBuild(): Promise<void> {
  const platform = await pickPlatform()
  if (!platform) return

  const release = await vscode.window.showQuickPick(['Debug', 'Release'], { placeHolder: 'Build type' })
  if (!release) return

  const releaseFlag = release === 'Release' ? ' --release' : ''
  runInTerminal('VastX Native: Build', getWorkspaceRoot(), `npx vastx-native build ${platform}${releaseFlag}`)
}

async function commandAnalyze(): Promise<void> {
  const platform = await pickPlatform()
  if (!platform) return
  runInTerminal('VastX Native: Analyze', getWorkspaceRoot(), `npx vastx-native analyze ${platform}`)
}

async function commandKeystoreCreate(): Promise<void> {
  const alias = await vscode.window.showInputBox({ prompt: 'Keystore alias', placeHolder: 'my-app' })
  if (!alias) return
  // keytool's own password/identity prompts are interactive — this runs
  // in a real terminal for the same reason devSession does, so those
  // prompts work exactly like running it by hand.
  runInTerminal('VastX Native: Keystore', getWorkspaceRoot(), `npx vastx-native keystore create --alias ${alias}`)
}

async function commandSelectDevice(): Promise<void> {
  const platform = await pickPlatform()
  if (!platform) return
  const deviceId = await pickDevice(platform)
  if (deviceId) selectedDeviceId = deviceId
}

async function commandStatusBarClicked(): Promise<void> {
  const session = getSession()
  if (session.getState() === 'stopped') {
    await commandRun()
    return
  }

  const action = await vscode.window.showQuickPick([
    { label: '$(sync) Hot Restart', action: 'hotRestart' },
    { label: '$(refresh) Force Restart (rebuild native)', action: 'forceRestart' },
    { label: '$(eye) Toggle File Watcher', action: 'toggleWatcher' },
    { label: '$(debug-stop) Stop', action: 'stop' }
  ], { placeHolder: 'VastX Native dev session' })

  if (!action) return
  session[action.action as 'hotRestart' | 'forceRestart' | 'toggleWatcher' | 'stop']()
}

async function pickPlatform(): Promise<'ios' | 'android' | undefined> {
  const platform = await vscode.window.showQuickPick(['android', 'ios'], { placeHolder: 'Platform' })
  return platform as 'ios' | 'android' | undefined
}

async function pickPlatforms(): Promise<string[] | undefined> {
  const picked = await vscode.window.showQuickPick(['android', 'ios'], {
    placeHolder: 'Platforms (select one or more)',
    canPickMany: true
  })
  return picked?.length ? picked : undefined
}

async function maybePickDevice(platform: 'ios' | 'android'): Promise<string | undefined> {
  if (selectedDeviceId) return selectedDeviceId
  return pickDevice(platform)
}

async function pickDevice(platform: 'ios' | 'android'): Promise<string | undefined> {
  try {
    const devices = await listDevices(getWorkspaceRoot())
    const relevant = devices.filter(d => d.platform.toLowerCase() === platform)
    if (relevant.length === 0) {
      vscode.window.showWarningMessage(`No connected ${platform} devices/emulators found — vastx-native dev will let ns pick automatically.`)
      return undefined
    }
    const picked = await vscode.window.showQuickPick(
      relevant.map(d => ({ label: d.displayName, description: `${d.type} — ${d.status}`, id: d.identifier })),
      { placeHolder: 'Device' }
    )
    return picked?.id
  } catch {
    // Device listing failing (e.g. adb/xcrun not on PATH) shouldn't block
    // running altogether — `ns run` picks a device on its own if none is
    // passed via --device.
    return undefined
  }
}

function wrapErrors(handler: (...args: unknown[]) => unknown) {
  return async (...args: unknown[]) => {
    try {
      await handler(...args)
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message ?? String(error))
    }
  }
}
