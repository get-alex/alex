'use strict'

var path = require('path')
var test = require('ava')
var execa = require('execa')

test('version', function(t) {
  return execa.stdout('./cli.js', ['-v']).then(function(result) {
    t.is(result, require('../package').version)
  })
})

test('help', function(t) {
  return execa.stdout('./cli.js', ['-h']).then(function(result) {
    t.regex(result, /Usage: alex \[<glob> ...] /)
  })
})

test('stdin', function(t) {
  return execa
    .stderr('./cli.js', ['--stdin'], {input: 'His'})
    .catch(function(error) {
      t.is(
        error.stderr,
        [
          '<stdin>',
          '  1:1-1:4  warning  `His` may be insensitive, use `Their`, `Theirs`, `Them` instead  her-him  retext-equality',
          '',
          '⚠ 1 warning',
          ''
        ].join('\n')
      )
    })
})

test('stdin and globs', function(t) {
  var rp = path.join('test', 'fixtures', 'one.md')

  return execa
    .stderr('./cli.js', ['--stdin', rp], {input: 'His'})
    .catch(function(error) {
      t.regex(error.stderr, /Do not pass globs with `--stdin`/)
    })
})

test('markdown by default', function(t) {
  var rp = path.join('test', 'fixtures', 'one.md')

  return execa.stderr('./cli.js', [rp]).then(function(result) {
    t.is(result, rp + ': no issues found')
  })
})

test('text optional', function(t) {
  var rp = path.join('test', 'fixtures', 'one.md')

  return execa.stderr('./cli.js', [rp, '--text']).catch(function(error) {
    t.is(
      error.stderr,
      [
        rp,
        '  1:18-1:21  warning  `his` may be insensitive, use `their`, `theirs`, `them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning',
        ''
      ].join('\n')
    )
  })
})

test('successful files', function(t) {
  var rp = path.join('test', 'fixtures', 'ok.txt')

  return execa.stderr('./cli.js', [rp]).then(function(result) {
    t.is(result, rp + ': no issues found')
  })
})

test('quiet on ok files', function(t) {
  var fp = path.join(__dirname, 'fixtures', 'ok.txt')

  return execa.stderr('./cli.js', [fp, '-q']).then(function(result) {
    t.is(result, '')
  })
})

test('quiet on nok files', function(t) {
  var rp = path.join('test', 'fixtures', 'one.md')

  return execa.stderr('./cli.js', [rp, '--text']).catch(function(error) {
    t.is(
      error.stderr,
      [
        rp,
        '  1:18-1:21  warning  `his` may be insensitive, use `their`, `theirs`, `them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning',
        ''
      ].join('\n')
    )
  })
})

test('binary (default)', function(t) {
  var rp = path.join('test', 'fixtures', 'binary', 'two.md')

  return execa.stderr('./cli.js', [rp]).then(function(result) {
    t.is(result, rp + ': no issues found')
  })
})

test('non-binary (optional)', function(t) {
  var rp = path.join('test', 'fixtures', 'non-binary', 'two.md')

  return execa.stderr('./cli.js', [rp]).catch(function(error) {
    var expected = [
      rp,
      '   1:1-1:3  warning  `He` may be insensitive, use `They`, `It` instead   he-she  retext-equality',
      '  1:7-1:10  warning  `she` may be insensitive, use `they`, `it` instead  he-she  retext-equality',
      '',
      '⚠ 2 warnings',
      ''
    ].join('\n')

    t.is(error.stderr, expected)
  })
})

test('default globs', function(t) {
  return execa.stderr('./cli.js').then(function(stderr) {
    var expected = [
      'contributing.md: no issues found',
      'readme.md: no issues found'
    ].join('\n')

    t.is(stderr, expected)
  })
})
