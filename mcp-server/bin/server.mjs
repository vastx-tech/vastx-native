#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { withCapturedOutput } from '../../cli/lib/run.mjs'
import { doctor } from '../../cli/commands/doctor.mjs'
import { build } from '../../cli/commands/build.mjs'
import { lint } from '../../cli/commands/lint.mjs'
import { clean } from '../../cli/commands/clean.mjs'
import { analyze } from '../../cli/commands/analyze.mjs'
import { version } from '../../cli/commands/version.mjs'
import { loadNativeConfig } from '../../cli/lib/load-config.mjs'
import { listDevices } from '../src/devices.mjs'
import { findApk, installApk, launchApp, readLogs } from '../src/android.mjs'

const server = new McpServer({ name: 'vastx-native', version: '0.1.0' })

/**
 * Every tool here calls into the exact same functions the real `vastx-native`
 * CLI uses (cli/commands/*.mjs) — nothing reimplemented, so behavior can
 * never drift between "a human runs the CLI" and "an agent drives it
 * through this server". process.chdir() is required since those functions
 * all operate on process.cwd(); withCapturedOutput() (see cli/lib/run.mjs)
 * is required because this server's stdout IS the MCP protocol channel —
 * doctor()/build()/etc.'s own console.log calls, and the real child
 * processes they spawn (`ns info`, `ns build`, ...), would otherwise
 * corrupt the JSON-RPC stream. Verified directly: ran doctor() through
 * withCapturedOutput() for real and confirmed zero output reached the
 * surrounding process's actual stdout, with the full report correctly
 * captured instead.
 */
async function runInProject(projectPath, fn) {
  const previousCwd = process.cwd()
  process.chdir(projectPath)
  try {
    return await withCapturedOutput(fn)
  } finally {
    process.chdir(previousCwd)
  }
}

function textResult(text) {
  return { content: [{ type: 'text', text }] }
}

server.registerTool(
  'doctor',
  {
    title: 'Check project configuration',
    description: 'Runs vastx-native\'s doctor checks (the same ones `vastx-native doctor` runs) against a project — catches misconfiguration this framework has actually hit before, then delegates to `ns info` for Xcode/Android SDK/JDK checks.',
    inputSchema: { projectPath: z.string().describe('Absolute path to the vastx-native project root') }
  },
  async ({ projectPath }) => {
    const { output, exitCode } = await runInProject(projectPath, doctor)
    return textResult(`${output}\n(exit code: ${exitCode})`)
  }
)

server.registerTool(
  'build',
  {
    title: 'Build the native app',
    description: 'Runs `vastx-native build <platform>` — regenerates the JS bundle and produces a native APK/IPA. Android only is confirmed working; iOS is unverified in this framework so far.',
    inputSchema: {
      projectPath: z.string().describe('Absolute path to the vastx-native project root'),
      platform: z.enum(['ios', 'android']),
      release: z.boolean().optional().describe('Pass --release (needs VASTX_NATIVE_KEYSTORE_* env vars set for a signed Android release)')
    }
  },
  async ({ projectPath, platform, release }) => {
    const { output, exitCode } = await runInProject(projectPath, () => build(platform, release ? ['--release'] : []))
    return textResult(`${output}\n(exit code: ${exitCode})`)
  }
)

server.registerTool(
  'lint',
  {
    title: 'Lint routes',
    description: 'Runs `vastx-native lint` — cross-references every navigate() call under app/ against the real route manifest, catching a typo\'d route name before a build.',
    inputSchema: { projectPath: z.string() }
  },
  async ({ projectPath }) => {
    const { output, exitCode } = await runInProject(projectPath, lint)
    return textResult(`${output}\n(exit code: ${exitCode})`)
  }
)

server.registerTool(
  'clean',
  {
    title: 'Clean build artifacts',
    description: 'Runs `vastx-native clean` — removes platforms/, hooks/, and cached build artifacts.',
    inputSchema: { projectPath: z.string() }
  },
  async ({ projectPath }) => {
    const { output, exitCode } = await runInProject(projectPath, clean)
    return textResult(`${output}\n(exit code: ${exitCode})`)
  }
)

server.registerTool(
  'analyze',
  {
    title: 'Analyze bundle size',
    description: 'Runs `vastx-native analyze <platform>` — produces a bundle size report (report/report.html, report/stats.json) under the project root.',
    inputSchema: { projectPath: z.string(), platform: z.enum(['ios', 'android']) }
  },
  async ({ projectPath, platform }) => {
    const { output, exitCode } = await runInProject(projectPath, () => analyze(platform))
    return textResult(`${output}\n(exit code: ${exitCode})`)
  }
)

server.registerTool(
  'version',
  {
    title: 'Show or bump the app release version',
    description: 'Runs `vastx-native version` — show the current version/versionCode, bump it (major/minor/patch, syncs to App_Resources/Android/app.gradle and App_Resources/iOS/Info.plist if present), or just re-sync the current values.',
    inputSchema: {
      projectPath: z.string(),
      action: z.enum(['show', 'bump', 'sync']).default('show'),
      part: z.enum(['major', 'minor', 'patch']).optional().describe('Required when action is "bump"')
    }
  },
  async ({ projectPath, action, part }) => {
    const { output, exitCode } = await runInProject(projectPath, () => version(action, part))
    return textResult(`${output}\n(exit code: ${exitCode})`)
  }
)

server.registerTool(
  'list_devices',
  {
    title: 'List connected devices/emulators',
    description: 'Runs `ns device --json` — every connected physical device and running emulator/simulator NativeScript can currently see.',
    inputSchema: { projectPath: z.string() }
  },
  async ({ projectPath }) => {
    const devices = await listDevices(projectPath)
    return textResult(JSON.stringify(devices, null, 2))
  }
)

server.registerTool(
  'install_and_launch',
  {
    title: 'Install and launch on an Android device',
    description: 'Installs the most recently built APK (platforms/android/app/build/outputs/apk/<buildType>/) via adb and launches it. Android only — build the app first with the `build` tool.',
    inputSchema: {
      projectPath: z.string(),
      buildType: z.enum(['debug', 'release']).optional().default('debug'),
      deviceId: z.string().optional().describe('adb device id — omit to use the only/default connected device')
    }
  },
  async ({ projectPath, buildType, deviceId }) => {
    const apkPath = findApk(projectPath, buildType)
    if (!apkPath) {
      return textResult(`No ${buildType} APK found under platforms/android/app/build/outputs/apk/${buildType}/ — run the "build" tool first.`)
    }
    const config = await loadNativeConfig(projectPath)
    const installOutput = await installApk(apkPath, deviceId)
    const launchOutput = await launchApp(config.appId, deviceId)
    return textResult(`Installed: ${apkPath}\n${installOutput}\n\nLaunched ${config.appId}:\n${launchOutput}`)
  }
)

server.registerTool(
  'read_logs',
  {
    title: 'Read device logs',
    description: 'Reads recent Android logcat output (adb logcat -d), optionally filtered — for checking whether the app just crashed or logged an error after a deploy.',
    inputSchema: {
      deviceId: z.string().optional(),
      filter: z.string().optional().describe('Case-insensitive substring filter, e.g. the app package id or "error"'),
      lines: z.number().optional().default(200).describe('Number of recent logcat lines to scan before filtering')
    }
  },
  async ({ deviceId, filter, lines }) => {
    const logs = await readLogs({ deviceId, filter, lines })
    return textResult(logs || '(no matching log lines)')
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
