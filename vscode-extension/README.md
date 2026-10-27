# VastX Native for VS Code

Run, hot-reload, and manage [VastX Native](https://github.com/vastx-tech/vastx-native)
projects without leaving VS Code.

## Features

- **Run** — pick a platform and a connected device/emulator, launches in a
  real integrated terminal (so `ns run`'s own interactive controls work
  exactly as if you'd typed the command yourself).
- **Hot Restart** / **Force Restart** / **Toggle File Watcher** — sends the
  same keypresses `ns run` listens for interactively, from the status bar
  or Command Palette instead of switching focus to the terminal.
- **Stop** — quits the running dev session cleanly.
- Every `vastx-native` CLI command (`doctor`, `build`, `analyze`, `lint`,
  `clean`, `keystore create`, `init`, `create`) from the Command Palette.

## Requirements

A VastX Native project (`npx github:vastx-tech/vastx-native create my-app`). The extension
activates when a workspace contains a `nativescript.config.ts`.

## Why a real terminal, not a background process

`ns run`'s hot-restart/force-restart/watcher-toggle controls only work over
a real TTY — confirmed by reading NativeScript CLI's own source
(`key-command-helper.js`): it calls `stdin.setRawMode`, and explicitly
falls back to a different, unwired mechanism when that's unavailable. A
plain background process has no TTY. This extension runs everything in a
genuine VS Code integrated terminal instead (`vscode.window.createTerminal`
+ `Terminal.sendText`), which is pty-backed, so the same interaction that
works when you run `ns run` by hand works identically here — you can also
click into the terminal at any point and type the same keys directly.

## Status

Early. Built and verified as far as this can be verified without a running
VS Code instance to load it into: it compiles cleanly against the real
`@types/vscode` API surface, and every NativeScript CLI behavior it relies
on (`ns device --json`'s exact output shape, the `r`/`R`/`w`/Ctrl+C key
commands, `ns run` needing a real TTY) was confirmed by reading
NativeScript's own source rather than assumed. **It has not yet been
loaded into an actual VS Code window and clicked through** — if something
doesn't work as described, that's the most likely reason, not a
theoretical gap.

## Development

```bash
cd vscode-extension
npm install
npm run compile     # or: npm run watch
```

Then, in VS Code, `F5` (Run Extension) to launch a development host with it
loaded, or `npm run package` to produce a `.vsix` for manual installation.
