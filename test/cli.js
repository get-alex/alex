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
  return execa.stdout('./cli.js', ['-v']).then(function (result) {
    t.is(result, require('../package').version);
  });
});

test('help', function (t) {
  return execa.stdout('./cli.js', ['-h']).then(function (result) {
    t.regex(result, /Usage: alex \[<glob> ...] /);
  });
});

test('markdown by default', function (t) {
  var rp = path.join('test', 'fixtures', 'one.md');

  return execa.stderr('./cli.js', [rp]).then(function (result) {
    t.is(result, rp + ': no issues found');
  });
});

test('text optional', function (t) {
  var rp = path.join('test', 'fixtures', 'one.md');

  return execa.stderr('./cli.js', [rp, '--text']).catch(function (err) {
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
  var rp = path.join('test', 'fixtures', 'ok.txt');

  return execa.stderr('./cli.js', [rp]).then(function (result) {
    t.is(result, rp + ': no issues found');
  });
});

test('quiet on ok files', function (t) {
  var fp = path.join(__dirname, 'fixtures', 'ok.txt');

  return execa.stderr('./cli.js', [fp, '-q']).then(function (result) {
    t.is(result, '');
  });
});

test('quiet on nok files', function (t) {
  var rp = path.join('test', 'fixtures', 'one.md');

  return execa.stderr('./cli.js', [rp, '--text']).catch(function (err) {
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

test('binary (default)', function (t) {
  var rp = path.join('test', 'fixtures', 'binary', 'two.md');

  return execa.stderr('./cli.js', [rp]).then(function (result) {
    t.is(result, rp + ': no issues found');
  });
});

test('non-binary (optional)', function (t) {
  var rp = path.join('test', 'fixtures', 'non-binary', 'two.md');

  return execa.stderr('./cli.js', [rp]).catch(function (err) {
    var expected = [
      rp,
      '   1:1-1:3  warning  `He` may be insensitive, use `They`, `It` instead   he-she  retext-equality',
      '  1:7-1:10  warning  `she` may be insensitive, use `they`, `it` instead  he-she  retext-equality',
      '',
      '⚠ 2 warnings',
      ''
    ].join('\n');

    t.is(err.stderr, expected);
  });
});
