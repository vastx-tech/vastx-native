# vastx-native MCP server

An [MCP](https://modelcontextprotocol.io) server exposing `vastx-native`'s
dev workflow — build, doctor, lint, clean, analyze, device listing,
install+launch, log reading — as tools, so any MCP-speaking AI agent
(Claude Code, Claude Desktop, or anything else that speaks MCP) can drive
a vastx-native project directly instead of shelling out to the CLI blind.

Every tool calls the exact same functions the real `vastx-native` CLI uses
(`cli/commands/*.mjs`) — nothing here is reimplemented, so there's no way
for "what the CLI does" and "what an agent driving it through this server
does" to drift apart.

## Setup

The server ships with `vastx-native`; its SDK dependencies are optional. Install
them in your app before starting the server:

```bash
npm install -D @modelcontextprotocol/sdk zod
```

From a project with the framework installed, the entry point is:

```bash
npx vastx-native mcp
```

Configure your agent to launch this command from your app's project directory.
The agent manages the server process; no separate server terminal, repository
clone, or `mcp-server/` directory in the app is needed. A manual launch waits
for MCP messages on stdin; it does not start an HTTP endpoint.

For Claude Code, add to `.mcp.json` in the app project:

```json
{
  "mcpServers": {
    "vastx-native": {
      "command": "npx",
      "args": ["vastx-native", "mcp"]
    }
  }
}
```

If a Windows host cannot launch npx directly, use `"command": "cmd"` and
`"args": ["/c", "npx", "vastx-native", "mcp"]`. If your host runs outside
the app directory, set its working directory or use `node` with the absolute
path to the app's `node_modules/vastx-native/bin/vastx-native.mjs` and `mcp`.
Configuration formats vary between agents.

Project tools take an absolute `projectPath` argument (the app to act on);
`read_logs` operates on the selected device without a project path. Run tools
sequentially because the CLI wrappers share process working-directory and
output-capture state. Android builds require the SDK/JDK; install and logs
require ADB. This stdio development server is separate from the mobile app's
`useMcpClient()` HTTP client.

For development of this server itself, install dependencies at the repository
root and run `node bin/vastx-native.mjs mcp`. The old
`node mcp-server/bin/server.mjs` entry point also remains available.

## Tools

| Tool | Wraps | Notes |
|---|---|---|
| `doctor` | `vastx-native doctor` | Project checks + delegates to `ns info` |
| `build` | `vastx-native build <platform>` | `release: true` for a signed build (needs `VASTX_NATIVE_KEYSTORE_*` env vars already set) |
| `lint` | `vastx-native lint` | Catches a `navigate()` call to a route that doesn't exist |
| `clean` | `vastx-native clean` | Removes `platforms/`, `hooks/`, cached artifacts |
| `analyze` | `vastx-native analyze <platform>` | Bundle size report |
| `version` | `vastx-native version [show\|bump\|sync]` | Show/bump/sync the release version — see the main README's "App release versioning" section |
| `list_devices` | `ns device --json` | Every connected device/emulator NativeScript can see |
| `install_and_launch` | `adb install` + `adb shell am start` | Android only. Uses the most recently built APK under `platforms/android/app/build/outputs/apk/<buildType>/` |
| `read_logs` | `adb logcat -d` | Optional substring filter — for checking whether a just-deployed build crashed |

## Why stdout capture matters here

This server talks to its client over **stdio** — meaning stdout *is* the
JSON-RPC protocol channel. `doctor()`/`build()`/etc. weren't written with
that constraint (they're CLI commands; they `console.log` directly, and
`ns info`/`ns build`'s own child processes inherit real stdio) — either of
those writing to stdout mid-tool-call would corrupt the connection.

Fixed at the shared layer, not per-tool: `cli/lib/run.mjs` exports
`withCapturedOutput()`, which every tool call here goes through. It's an
ambient, module-level toggle — when set, `run()` pipes and buffers
instead of inheriting, and `console.log`/`console.error` are captured too
— restored automatically even if the wrapped function throws. The real
CLI's own direct terminal usage is completely unaffected (the toggle
defaults off, and no existing call site needed to change). Verified
directly, not just reasoned about: ran `doctor()` through it for real and
confirmed zero output reached the actual process stdout in between, with
the full report correctly captured instead.

## Verifying it works

From the framework repository root, `npm run test:mcp` checks npm's packaging
allowlist and launches the packaged CLI from a temporary app. It verifies tool
discovery and a read-only version call without requiring Android tooling.

```bash
node test-client.mjs /absolute/path/to/a/vastx-native/project
# add --full to also exercise install_and_launch/read_logs
# (needs a real connected Android device and an existing build)
```

This is a real MCP client (the SDK's own `Client` + `StdioClientTransport`),
spawning the real server and driving it over the real protocol — not a
mock of either side. Verified end to end against a real project: `doctor`
returns the full captured report, `list_devices` returns real device JSON
(or the real underlying error — e.g. `list_devices` fails with a genuine
`ios-device-lib` `ENOENT` on Windows, a real pre-existing NativeScript CLI
limitation with no iOS tooling here, not a bug in this server), and with
`--full`, `install_and_launch` + `read_logs` were confirmed against an
actual physical Android device — real install, real launch, real logcat
output.

## Status

Android-only in practice so far, same as the rest of this framework —
`install_and_launch` doesn't attempt an iOS equivalent yet (`xcrun simctl`
install/launch would be the analogous path, unverified since this was
built and tested on Windows with no iOS tooling available).
