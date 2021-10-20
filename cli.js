#!/usr/bin/env node
import fs from 'fs'
import notifier from 'update-notifier'
import supportsColor from 'supports-color'
import meow from 'meow'
import engine from 'unified-engine'
import unified from 'unified'
import markdown from 'remark-parse'
import html from 'rehype-parse'
import frontmatter from 'remark-frontmatter'
import mdx from 'remark-mdx'
import english from 'retext-english'
import remark2retext from 'remark-retext'
import rehype2retext from 'rehype-retext'
import defaultReporter from 'vfile-reporter'
import equality from 'retext-equality'
import profanities from 'retext-profanities'
import diff from 'unified-diff'
import {filter} from './filter.js'

const pack = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url))
)

var textExtensions = [
  'txt',
  'text',
  'md',
  'markdown',
  'mkd',
  'mkdn',
  'mkdown',
  'ron'
]
var htmlExtensions = ['htm', 'html']
var mdxExtensions = ['mdx']

// Update messages.
notifier({pkg: pack}).notify()

// Set-up meow.
var cli = meow(
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
var extensions = cli.flags.html
  ? htmlExtensions
  : cli.flags.mdx
  ? mdxExtensions
  : textExtensions
var defaultGlobs = ['{docs/**/,doc/**/,}*.{' + extensions.join(',') + '}']
var silentlyIgnore
var globs

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
    extensions: extensions,
    configTransform: transform,
    out: false,
    output: false,
    rcName: '.alexrc',
    packageField: 'alex',
    color: supportsColor.stderr,
    reporter: cli.flags.reporter || defaultReporter,
    reporterOptions: {
      verbose: cli.flags.why
    },
    quiet: cli.flags.quiet,
    ignoreName: '.alexignore',
    silentlyIgnore: silentlyIgnore,
    frail: true,
    defaultConfig: transform()
  },
  function (error, code) {
    if (error) console.error(error.message)
    process.exit(code)
  }
)

function transform(options) {
  var settings = options || {}
  var plugins = [
    english,
    [profanities, {sureness: settings.profanitySureness}],
    [equality, {noBinary: settings.noBinary}]
  ]

  if (cli.flags.html) {
    plugins = [html, [rehype2retext, unified().use({plugins: plugins})]]
  } else if (cli.flags.mdx) {
    plugins = [
      markdown,
      mdx,
      [remark2retext, unified().use({plugins: plugins})]
    ]
  } else if (!cli.flags.text) {
    plugins = [
      markdown,
      [frontmatter, ['yaml', 'toml']],
      [remark2retext, unified().use({plugins: plugins})]
    ]
  }

  plugins.push([filter, {allow: settings.allow, deny: settings.deny}])

  // Hard to check.
  /* c8 ignore next 3 */
  if (cli.flags.diff) {
    plugins.push(diff)
  }

  return {plugins: plugins}
}
