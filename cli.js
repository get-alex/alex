#!/usr/bin/env node
import fs from 'node:fs'
import process from 'node:process'
import {URL} from 'node:url'
import notifier from 'update-notifier'
import supportsColor from 'supports-color'
import meow from 'meow'
import {engine} from 'unified-engine'
import {unified} from 'unified'
import rehypeParse from 'rehype-parse'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import retextEnglish from 'retext-english'
import remarkRetext from 'remark-retext'
import rehypeRetext from 'rehype-retext'
import vfileReporter from 'vfile-reporter'
import retextEquality from 'retext-equality'
import retextProfanities from 'retext-profanities'
import unifiedDiff from 'unified-diff'
import {filter} from './filter.js'

/** @type {import('type-fest').PackageJson} */
const pack = JSON.parse(
  String(fs.readFileSync(new URL('package.json', import.meta.url)))
)

const textExtensions = [
  'txt',
  'text',
  'md',
  'markdown',
  'mkd',
  'mkdn',
  'mkdown',
  'ron'
]
const htmlExtensions = ['htm', 'html']
const mdxExtensions = ['mdx']

// Update messages.
/** @ts-expect-error: `package.json` is fine. */
notifier({pkg: pack}).notify()

// Set-up meow.
const cli = meow(
  [
    'Usage: alex [<glob> ...] [options ...]',
    '',
    'Options:',
    '',
    '  -w, --why               output sources (when available)',
    '  -q, --quiet             output only warnings and errors',
    '  -t, --text              treat input as plain-text (not markdown)',
    '  -l, --html              treat input as html (not markdown)',
    '      --mdx               treat input as mdx (not markdown)',
    '  -d, --diff              ignore unchanged lines (affects Travis only)',
    '      --reporter=REPORTER use a custom vfile-reporter',
    '  --stdin                 read from stdin',
    '',
    'When no input files are given, searches for markdown and text',
    'files in the current directory, `doc`, and `docs`.',
    '',
    'Examples',
    '  $ echo "His network looks good" | alex --stdin',
    '  $ alex *.md !example.md',
    '  $ alex'
  ].join('\n'),
  {
    importMeta: import.meta,
    flags: {
      version: {type: 'boolean', alias: 'v'},
      help: {type: 'boolean', alias: 'h'},
      stdin: {type: 'boolean'},
      text: {type: 'boolean', alias: 't'},
      mdx: {type: 'boolean'},
      html: {type: 'boolean', alias: 'l'},
      diff: {type: 'boolean', alias: 'd'},
      reporter: {type: 'string'},
      quiet: {type: 'boolean', alias: 'q'},
      why: {type: 'boolean', alias: 'w'}
    }
  }
)

// Set-up.
const extensions = cli.flags.html
  ? htmlExtensions
  : cli.flags.mdx
  ? mdxExtensions
  : textExtensions
const defaultGlobs = ['{docs/**/,doc/**/,}*.{' + extensions.join(',') + '}']
/** @type {boolean|undefined} */
let silentlyIgnore
/** @type {string[]|undefined} */
let globs

if (cli.flags.stdin) {
  if (cli.input.length > 0) {
    throw new Error('Do not pass globs with `--stdin`')
  }
} else if (cli.input.length === 0) {
  globs = defaultGlobs
  silentlyIgnore = true
} else {
  globs = cli.input
}

engine(
  {
    processor: unified(),
    files: globs,
    extensions,
    configTransform: transform,
    out: false,
    output: false,
    rcName: '.alexrc',
    packageField: 'alex',
    color: Boolean(supportsColor.stderr),
    reporter: cli.flags.reporter || vfileReporter,
    reporterOptions: {
      verbose: cli.flags.why
    },
    quiet: cli.flags.quiet,
    ignoreName: '.alexignore',
    silentlyIgnore,
    frail: true,
    defaultConfig: transform({})
  },
  function (error, code) {
    if (error) console.error(error.message)
    process.exit(code)
  }
)

/**
 * @param {import('./index.js').OptionsObject} [options]
 */
function transform(options = {}) {
  /** @type {import('unified').PluggableList} */
  let plugins = [
    retextEnglish,
    [retextProfanities, {sureness: options.profanitySureness}],
    [retextEquality, {noBinary: options.noBinary}]
  ]

  if (cli.flags.html) {
    plugins = [rehypeParse, [rehypeRetext, unified().use({plugins})]]
  } else if (cli.flags.mdx) {
    // @ts-expect-error: types are having a hard time for bridges.
    plugins = [remarkParse, remarkMdx, [remarkRetext, unified().use({plugins})]]
  } else if (!cli.flags.text) {
    plugins = [
      remarkParse,
      remarkGfm,
      [remarkFrontmatter, ['yaml', 'toml']],
      // @ts-expect-error: types are having a hard time for bridges.
      [remarkRetext, unified().use({plugins})]
    ]
  }

  plugins.push([filter, {allow: options.allow, deny: options.deny}])

  // Hard to check.
  /* c8 ignore next 3 */
  if (cli.flags.diff) {
    plugins.push(unifiedDiff)
  }

  return {plugins}
}
