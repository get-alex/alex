#!/usr/bin/env node
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module alex
 * @fileoverview CLI for alex.
 */

'use strict';

/* Dependencies. */
var PassThrough = require('stream').PassThrough;
var notifier = require('update-notifier');
var meow = require('meow');
var engine = require('unified-engine');
var unified = require('unified');
var markdown = require('remark-parse');
var english = require('retext-english');
var remark2retext = require('remark-retext');
var report = require('vfile-reporter');
var equality = require('retext-equality');
var profanities = require('retext-profanities');
var diff = require('unified-diff');
var pack = require('./package');
var filter = require('./filter');

var extensions = [
  'txt',
  'text',
  'md',
  'markdown',
  'mkd',
  'mkdn',
  'mkdown',
  'ron'
];

/* Update messages. */
notifier({pkg: pack}).notify();

/* Set-up meow. */
var cli = meow({
  help: [
    'Usage: alex [<glob> ...] [options ...]',
    '',
    'Options:',
    '',
    '  -w, --why    output sources (when available)',
    '  -q, --quiet  output only warnings and errors',
    '  -t, --text   treat input as plain-text (not markdown)',
    '  -d, --diff   ignore unchanged lines (affects Travis only)',
    '',
    'When no input files are given, searches for markdown and text',
    'files in the current directory, `doc`, and `docs`.',
    '',
    'Examples',
    '  $ echo "His network looks good" | alex',
    '  $ alex *.md !example.md',
    '  $ alex'
  ]
}, {
  alias: {
    v: 'version',
    h: 'help',
    t: 'text',
    d: 'diff',
    q: 'quiet',
    w: 'why'
  }
});

/* Set-up. */
var globs = ['{docs/**/,doc/**/,}*.{' + extensions.join(',') + '}'];

/* istanbul ignore else - Bug in tests. Something hangs, at least. */
if (cli.input.length !== 0) {
  globs = cli.input;
}

engine({
  processor: unified(),
  files: globs,
  extensions: extensions,
  configTransform: transform,
  output: false,
  out: false,
  streamError: new PassThrough(),
  rcName: '.alexrc',
  packageField: 'alex',
  ignoreName: '.alexignore',
  frail: true,
  defaultConfig: transform()
}, function (err, code, result) {
  var out = report(err || result.files, {
    verbose: cli.flags.why,
    quiet: cli.flags.quiet
  });

  if (out) {
    console.error(out);
  }

  process.exit(code);
});

function transform(options) {
  var settings = options || {};
  var plugins = [
    english,
    profanities,
    [equality, {noBinary: settings.noBinary}]
  ];

  if (!cli.flags.text) {
    plugins = [
      markdown,
      [remark2retext, unified().use({plugins: plugins})]
    ];
  }

  plugins.push([filter, {allow: settings.allow}]);

  /* istanbul ignore if - hard to check. */
  if (cli.flags.diff) {
    plugins.push(diff);
  }

  return {plugins: plugins};
}
