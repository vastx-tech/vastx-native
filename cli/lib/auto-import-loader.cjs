'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { loadVueCompiler } = require('./vue-compiler.cjs')

// Loaders execute per-file, potentially many times per build (and again on
// every incremental rebuild in `vastx-native dev`) — read+parse
// .vastx-native/auto-imports.json once per webpack process, not per file.
// A dev-mode restart (the normal way to pick up a newly added composable
// file, same workflow as any other new-file case in this CLI) naturally
// clears this cache along with the whole process.
let cachedEntries = null
let cachedFromPath = null

function loadEntries(rootContext) {
  const entriesPath = path.join(rootContext, '.vastx-native', 'auto-imports.json')
  if (cachedEntries && cachedFromPath === entriesPath) return cachedEntries

  if (!fs.existsSync(entriesPath)) {
    cachedEntries = []
    cachedFromPath = entriesPath
    return cachedEntries
  }

  cachedEntries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'))
  cachedFromPath = entriesPath
  return cachedEntries
}

/**
 * A first-party auto-import transform — not the `unimport` package Nuxt
 * itself uses, since `unimport` ships ESM-only and this loader has to run
 * inside `@nativescript/webpack`'s webpack.config.cjs, which is loaded
 * with a plain, synchronous `require(configPath)(env)`.
 *
 * Names are found with Vue's own parsers, not text matching. The earlier
 * regex scan matched a name anywhere in the SFC, template included, and
 * only recognised single-line `import`s and plain `const x` declarations.
 * So a component with a `placeholder` or `size` prop used in its template
 * got `import { placeholder } from 'vastx-native/runtime/style.js'`
 * injected into `<script setup>` — and a setup binding beats a prop in the
 * template. That only showed up in release builds: in dev, vue-loader
 * compiles the template from the untouched file (prop wins); in
 * production it inlines the template into our modified `<script setup>`
 * (import wins).
 *
 * Now:
 * - script: free identifier references from a real Babel AST
 *   (`walkIdentifiers`), minus every top-level declaration — comments,
 *   member access, object keys, types, function params, destructuring and
 *   multi-line imports are all handled by the parser, not by regexes.
 * - template: compiled with `prefixIdentifiers`, so every free template
 *   reference comes out as `_ctx.name`, with v-for aliases and slot props
 *   already excluded by Vue's own scope tracking.
 * - anything the component itself binds — props, setup bindings, Options
 *   API members; `compileScript().bindings`, exactly what the template
 *   resolves against — is never imported for the template.
 * - imports go into `<script setup>` when there is one: a plain `<script>`
 *   block's imports aren't visible to the template.
 *
 * vue-loader hands every `.vue` sub-request the *whole* SFC (it re-parses
 * `source` each time), so imports are spliced into the chosen block's
 * content rather than prepended to the string — prepending lands them
 * outside every block, where vue-loader silently drops them.
 */
module.exports = function autoImportLoader(source) {
  // Belt-and-suspenders, not decorative: the webpack rule's declarative
  // resourceQuery restriction was confirmed (via direct instrumentation of
  // a real build) to not reliably exclude the sibling <template>
  // sub-request once @nativescript/webpack merges its own config on top.
  // Never touch a request whose resourceQuery says it's anything other
  // than a script block, nor a plain .ts request that's a declaration file.
  if (this.resourceQuery && !/type=script/.test(this.resourceQuery)) return source
  if (/\.d\.ts$/.test(this.resourcePath)) return source

  const rootContext = this.rootContext || process.cwd()
  const entries = loadEntries(rootContext)
  if (entries.length === 0) return source

  const compiler = loadVueCompiler(rootContext)
  const byName = new Map(entries.map(entry => [entry.name, entry]))
  const render = names => [...names].map((name) => {
    const { from, export: exported = name } = byName.get(name)
    const spec = exported === name ? name : `${exported} as ${name}`
    return `import { ${spec} } from ${JSON.stringify(from)};`
  }).join('\n')

  if (!/\.vue$/.test(this.resourcePath)) {
    let script
    try {
      script = analyzeScript(compiler, source, /\.tsx?$/.test(this.resourcePath))
    } catch {
      return source // a syntax error — the real TS/JS compile step reports it properly
    }
    const missing = [...script.used].filter(name => byName.has(name) && !script.declared.has(name))
    return missing.length ? `${render(missing)}\n${source}` : source
  }

  const { descriptor } = compiler.parse(source, { filename: this.resourcePath })
  const target = descriptor.scriptSetup || descriptor.script
  if (!target || target.src) return source

  const declared = new Set()
  const scriptUsed = new Set()
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block || block.src) continue
    let script
    try {
      script = analyzeScript(compiler, block.content, /^tsx?$/.test(block.lang || ''))
    } catch {
      return source
    }
    script.declared.forEach(name => declared.add(name))
    script.used.forEach(name => scriptUsed.add(name))
  }

  const bindings = componentBindings(compiler, descriptor)
  const missing = new Set()

  for (const name of scriptUsed) {
    if (!byName.has(name) || declared.has(name)) continue
    if (descriptor.scriptSetup && bindings?.[name] === 'props') {
      // Importing would make the template see the helper instead of the
      // prop; skipping would leave the script with an undefined name.
      // Fail the build rather than pick either silently.
      this.emitError(new Error(`vastx-native auto-imports: \`${name}\` is both a prop of this component and an auto-imported helper used in its script. Rename the prop, or import the helper explicitly under another name: import { ${name} as ${name}Helper } from ${JSON.stringify(byName.get(name).from)}`))
      continue
    }
    missing.add(name)
  }

  const templateUsed = [...templateReferences(compiler, descriptor, this.resourcePath)]
    .filter(name => byName.has(name) && !declared.has(name) && !missing.has(name))
  if (templateUsed.length > 0) {
    if (!descriptor.scriptSetup) {
      this.emitWarning(new Error(`vastx-native auto-imports: ${templateUsed.map(n => `\`${n}\``).join(', ')} used in the template of a component without <script setup> — imports in a plain <script> aren't visible to the template. Expose them from the component (e.g. methods) or switch to <script setup>.`))
    } else if (!bindings) {
      // Couldn't work out the component's own bindings (see
      // componentBindings), so any of these could be a prop. Never risk
      // shadowing one: ask for an explicit import instead.
      this.emitWarning(new Error(`vastx-native auto-imports: couldn't analyse this component's props, so ${templateUsed.map(n => `\`${n}\``).join(', ')} (used only in the template) were not auto-imported. Import them explicitly if they're helpers rather than props.`))
    } else {
      templateUsed.filter(name => !(name in bindings)).forEach(name => missing.add(name))
    }
  }

  if (missing.size === 0) return source

  const insertAt = target.loc.start.offset
  return source.slice(0, insertAt) + '\n' + render(missing) + source.slice(insertAt)
}

function analyzeScript(compiler, code, isTs) {
  const ast = compiler.babelParse(code, {
    sourceType: 'module',
    plugins: isTs ? ['typescript'] : []
  })

  const declared = new Set()
  for (let node of ast.program.body) {
    if ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') && node.declaration) {
      node = node.declaration
    }
    if (node.type === 'ImportDeclaration') {
      node.specifiers.forEach(spec => declared.add(spec.local.name))
    } else if (node.type === 'VariableDeclaration') {
      node.declarations.forEach(decl => compiler.extractIdentifiers(decl.id).forEach(id => declared.add(id.name)))
    } else if (node.id && /^(?:FunctionDeclaration|ClassDeclaration|TSEnumDeclaration)$/.test(node.type)) {
      declared.add(node.id.name)
    }
  }

  // Reports only references not bound by an enclosing function/block
  // scope; top-level declarations are subtracted via `declared`.
  const used = new Set()
  compiler.walkIdentifiers(ast.program, (id, _parent, _stack, _isReference, isLocal) => {
    if (!isLocal) used.add(id.name)
  })

  return { declared, used }
}

// Everything the component binds for its template: props, setup bindings,
// Options API members. null when compileScript can't analyse the file —
// e.g. defineProps<T>() with a T it can't resolve.
function componentBindings(compiler, descriptor) {
  try {
    return compiler.compileScript(descriptor, {
      id: 'vastx-native-auto-import',
      fs: {
        fileExists: file => fs.existsSync(file),
        readFile: file => fs.readFileSync(file, 'utf8')
      }
    }).bindings || {}
  } catch {
    return null
  }
}

function templateReferences(compiler, descriptor, filename) {
  const template = descriptor.template
  if (!template || template.src || (template.lang && template.lang !== 'html')) return new Set()

  const { code } = compiler.compileTemplate({
    source: template.content,
    filename,
    id: 'vastx-native-auto-import',
    compilerOptions: { prefixIdentifiers: true }
  })
  return new Set([...code.matchAll(/\b_ctx\.([A-Za-z_$][\w$]*)/g)].map(match => match[1]))
}
