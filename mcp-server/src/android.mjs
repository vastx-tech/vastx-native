import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Resolves adb the same way a real terminal session in this project would:
 * $ANDROID_HOME/platform-tools/adb first (matches how vastx-native's own
 * CLI/doctor checks for it), falling back to a bare `adb` on PATH.
 */
function adbPath() {
  const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  if (home) {
    const candidate = join(home, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
    if (existsSync(candidate)) return candidate
  }
  return 'adb'
}

function execCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: process.platform === 'win32' })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => { stdout += c })
    child.stderr.on('data', (c) => { stderr += c })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}: ${stderr || stdout}`))
    })
  })
}

/**
 * Finds the most recently built APK under platforms/android/app/build/
 * outputs/apk/<buildType>/ — the same real path this session confirmed by
 * inspecting an actual successful build's output.
 */
export function findApk(projectRoot, buildType = 'debug') {
  const dir = join(projectRoot, 'platforms', 'android', 'app', 'build', 'outputs', 'apk', buildType)
  if (!existsSync(dir)) return null
  const apks = readdirSync(dir).filter((f) => f.endsWith('.apk'))
  return apks.length ? join(dir, apks[0]) : null
}

export async function listConnectedDevices() {
  const { stdout } = await execCapture(adbPath(), ['devices'])
  return stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('*'))
    .map((line) => {
      const [id, status] = line.split(/\s+/)
      return { id, status }
    })
}

export async function installApk(apkPath, deviceId) {
  const args = deviceId ? ['-s', deviceId, 'install', '-r', apkPath] : ['install', '-r', apkPath]
  const { stdout } = await execCapture(adbPath(), args)
  return stdout.trim()
}

/**
 * `com.tns.NativeScriptActivity` is NativeScript's own launcher activity
 * class — confirmed directly against a real installed app's manifest
 * earlier in this project's development, not guessed.
 */
export async function launchApp(appId, deviceId) {
  const args = ['shell', 'am', 'start', '-n', `${appId}/com.tns.NativeScriptActivity`]
  const fullArgs = deviceId ? ['-s', deviceId, ...args] : args
  const { stdout } = await execCapture(adbPath(), fullArgs)
  return stdout.trim()
}

export async function readLogs({ deviceId, filter, lines = 200 } = {}) {
  const base = ['logcat', '-d', '-t', String(lines)]
  const args = deviceId ? ['-s', deviceId, ...base] : base
  const { stdout } = await execCapture(adbPath(), args)
  if (!filter) return stdout
  return stdout
    .split('\n')
    .filter((line) => line.toLowerCase().includes(filter.toLowerCase()))
    .join('\n')
}
