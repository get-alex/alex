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
var pack = require('./package');

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
if (cli.input.length) {
  globs = cli.input;
}

var processor = unified();

if (cli.flags.text) {
  processor.use(english);
} else {
  processor
    .use(markdown)
    .use(remark2retext, english.Parser);
}

var filter = require.resolve('./filter.js');
var equality = require.resolve('retext-equality');

var plugins = [
  equality,
  require.resolve('retext-profanities'),
  filter
];

/* istanbul ignore if - hard to check. */
if (cli.flags.diff) {
  plugins.push(require.resolve('unified-diff'));
}

engine({
  processor: processor,
  globs: globs,
  extensions: extensions,
  configTransform: transform,
  output: false,
  out: false,
  streamError: new PassThrough(),
  rcName: '.alexrc',
  packageField: 'alex',
  ignoreName: '.alexignore',
  plugins: plugins,
  frail: true
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

function transform(raw) {
  var allow = raw.allow || /* istanbul ignore next */ [];

  return function (current) {
    var plugins = {};

    current = current.plugins && current.plugins[filter] && current.plugins[filter].allow;

    if (allow.length) {
      plugins[filter] = {allow: [].concat(allow, current || [])};
    }

    if ('noBinary' in raw) {
      plugins[equality] = {noBinary: raw.noBinary};
    }

    return {plugins: plugins};
  };
}
