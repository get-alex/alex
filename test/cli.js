/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module alex:test:cli
 * @fileoverview Test suite for alex.
 */

'use strict';

/* Dependencies. */
var path = require('path');
var test = require('ava');
var execa = require('execa');

test('version', function (t) {
  return execa.stdout('../cli.js', ['-v']).then(function (result) {
    t.is(result, require('../package').version);
  });
});

test('help', function (t) {
  return execa.stdout('../cli.js', ['-h']).then(function (result) {
    t.regex(result, /Usage: alex \[<glob> ...\] /);
  });
});

test('markdown by default', function (t) {
  var rp = path.join('fixtures', 'one.md');
  var fp = path.join(__dirname, rp);

  return execa.stderr('../cli.js', [fp]).then(function (result) {
    t.is(result, rp + ': no issues found');
  });
});

test('text optional', function (t) {
  var rp = path.join('fixtures', 'one.md');
  var fp = path.join(__dirname, rp);

  return execa.stderr('../cli.js', [fp, '--text']).catch(function (err) {
    t.is(
      err.stderr,
      [
        rp,
        '  1:18-1:21  warning  `his` may be insensitive, use `their`, `theirs`, `them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning',
        ''
      ].join('\n')
    );
  });
});

test('successful files', function (t) {
  var rp = path.join('fixtures', 'ok.txt');
  var fp = path.join(__dirname, rp);

  return execa.stderr('../cli.js', [fp]).then(function (result) {
    t.is(result, rp + ': no issues found');
  });
});

test('quiet on ok files', function (t) {
  var fp = path.join(__dirname, 'fixtures', 'ok.txt');

  return execa.stderr('../cli.js', [fp, '-q']).then(function (result) {
    t.is(result, '');
  });
});

test('quiet on nok files', function (t) {
  var rp = path.join('fixtures', 'one.md');
  var fp = path.join(__dirname, rp);

  return execa.stderr('../cli.js', [fp, '--text']).catch(function (err) {
    t.is(
      err.stderr,
      [
        rp,
        '  1:18-1:21  warning  `his` may be insensitive, use `their`, `theirs`, `them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning',
        ''
      ].join('\n')
    );
  });
});
