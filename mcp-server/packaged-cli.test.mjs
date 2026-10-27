import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { indexPage, packageJson, projectReadme } from '../cli/lib/scaffold-templates.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

test('packaged CLI serves MCP from a new app without a server folder', { timeout: 60000 }, async () => {
  // Run through npm run test:mcp so the same npm CLI works on Windows and Unix.
  assert.ok(process.env.npm_execpath, 'Run npm run test:mcp')
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.ok(pkg.devDependencies['@modelcontextprotocol/sdk'])
  assert.ok(pkg.devDependencies.zod)
  assert.equal(pkg.peerDependenciesMeta['@modelcontextprotocol/sdk'].optional, true)
  assert.equal(pkg.peerDependenciesMeta.zod.optional, true)

  const scratch = mkdtempSync(join(tmpdir(), 'vastx-native-mcp-'))
  const staging = join(scratch, 'source')
  const distribution = join(scratch, 'framework')
  const app = join(scratch, 'my-app')
  const client = new Client({ name: 'packaged-cli-test', version: '1.0.0' })
  try {
    // Exercise npm's actual files allowlist without rebuilding the unrelated
    // Nuxt module. Some npm versions run prepare even with --ignore-scripts.
    mkdirSync(staging)
    writeFileSync(join(staging, 'package.json'), JSON.stringify({ ...pkg, scripts: {} }))
    for (const path of ['bin', 'cli', 'STYLING.md', 'mcp-server/bin', 'mcp-server/src', 'mcp-server/package.json', 'mcp-server/README.md']) {
      cpSync(join(root, path), join(staging, path), { recursive: true })
    }
    const [pack] = JSON.parse(execFileSync(process.execPath, [
      process.env.npm_execpath, 'pack', '--dry-run', '--json', '--ignore-scripts'
    ], { cwd: staging, encoding: 'utf8', timeout: 30000 }))
    const files = new Set(pack.files.map(file => file.path))
    for (const path of ['bin/vastx-native.mjs', 'mcp-server/bin/server.mjs', 'mcp-server/src/android.mjs', 'mcp-server/src/devices.mjs']) {
      assert.ok(files.has(path), `Package is missing ${path}`)
    }
    assert.ok(!files.has('mcp-server/package.json'), 'Use the main package dependencies')
    assert.ok(files.has('cli/lib/native-tailwind.cjs'))
    assert.ok(files.has('STYLING.md'))
    assert.ok(!files.has('cli/tests/styling.test.mjs'))
    // Only copy files npm would ship, so repository-only imports fail here.
    for (const file of files) {
      const target = join(distribution, file)
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(join(staging, file), target)
    }
    symlinkSync(join(root, 'node_modules'), join(distribution, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    mkdirSync(join(app, 'app/pages'), { recursive: true })
    writeFileSync(join(app, 'package.json'), packageJson('my-app'))
    writeFileSync(join(app, 'app/pages/index.vue'), indexPage())
    writeFileSync(join(app, 'README.md'), projectReadme())

    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [join(distribution, 'bin/vastx-native.mjs'), 'mcp'],
      cwd: app,
      stderr: 'pipe'
    }))
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map(tool => tool.name).sort(), [
      'analyze', 'build', 'clean', 'doctor', 'install_and_launch',
      'lint', 'list_devices', 'read_logs', 'version'
    ])
    const result = await client.callTool({ name: 'version', arguments: { projectPath: app, action: 'show' } })
    assert.ok(!result.isError, JSON.stringify(result))
    assert.match(result.content[0].text, /version.*versionCode/)
    // A second protocol exchange verifies captured CLI output did not corrupt stdout.
    assert.equal((await client.listTools()).tools.length, 9)
  } finally {
    await client.close()
    // Unlink the dependency junction first; never recurse into shared dependencies.
    if (existsSync(join(distribution, 'node_modules'))) unlinkSync(join(distribution, 'node_modules'))
    rmSync(scratch, { force: true, recursive: true })
  }
})
