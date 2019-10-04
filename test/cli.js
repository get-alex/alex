'use strict'

var path = require('path')
var test = require('ava')
var execa = require('execa')

test('version', function(t) {
  return execa('./cli.js', ['-v']).then(function(result) {
    t.is(result.stdout, require('../package').version)
  })
})

test('help', function(t) {
  return execa('./cli.js', ['-h']).then(function(result) {
    t.regex(result.stdout, /Usage: alex \[<glob> ...] /)
  })
})

test('stdin', function(t) {
  return execa('./cli.js', ['--stdin'], {input: 'His'}).catch(function(error) {
    t.is(
      error.stderr,
      [
        '<stdin>',
        '  1:1-1:4  warning  `His` may be insensitive, when referring to a person, use `Their`, `Theirs`, `Them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning'
      ].join('\n')
    )
  })
})

test('stdin and globs', function(t) {
  var rp = path.join('test', 'fixtures', 'one.md')

  return execa('./cli.js', ['--stdin', rp]).catch(function(error) {
    t.regex(error.stderr, /Do not pass globs with `--stdin`/)
  })
})

test('markdown by default', function(t) {
  var rp = path.join('test', 'fixtures', 'one.md')

  return execa('./cli.js', [rp]).then(function(result) {
    t.is(result.stderr, rp + ': no issues found')
  })
})

test('text optional', function(t) {
  var rp = path.join('test', 'fixtures', 'one.md')

  return execa('./cli.js', [rp, '--text']).catch(function(error) {
    t.is(
      error.stderr,
      [
        rp,
        '  1:18-1:21  warning  `his` may be insensitive, when referring to a person, use `their`, `theirs`, `them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning'
      ].join('\n')
    )
  })
})

test('text on html', function(t) {
  var rp = path.join('test', 'fixtures', 'three.html')
  return execa('./cli.js', [rp, '--text']).catch(function(error) {
    t.regex(error.stderr, /9 warnings/)
  })
})

test('html optional', function(t) {
  var rp = path.join('test', 'fixtures', 'three.html')

  return execa('./cli.js', [rp, '--html']).catch(function(error) {
    t.is(
      error.stderr,
      [
        rp,
        '  9:18-9:20  warning  `He` may be insensitive, use `They`, `It` instead   he-she  retext-equality',
        '  10:1-10:4  warning  `She` may be insensitive, use `They`, `It` instead  he-she  retext-equality',
        '',
        '⚠ 2 warnings'
      ].join('\n')
    )
  })
})

test('successful files', function(t) {
  var rp = path.join('test', 'fixtures', 'ok.txt')

  return execa('./cli.js', [rp]).then(function(result) {
    t.is(result.stderr, rp + ': no issues found')
  })
})

test('quiet on ok files', function(t) {
  var fp = path.join(__dirname, 'fixtures', 'ok.txt')

  return execa('./cli.js', [fp, '-q']).then(function(result) {
    t.is(result.stderr, '')
  })
})

test('quiet on nok files', function(t) {
  var rp = path.join('test', 'fixtures', 'one.md')

  return execa('./cli.js', [rp, '--text']).catch(function(error) {
    t.is(
      error.stderr,
      [
        rp,
        '  1:18-1:21  warning  `his` may be insensitive, when referring to a person, use `their`, `theirs`, `them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning'
      ].join('\n')
    )
  })
})

test('binary (default)', function(t) {
  var rp = path.join('test', 'fixtures', 'binary', 'two.md')

  return execa('./cli.js', [rp]).then(function(result) {
    t.is(result.stderr, rp + ': no issues found')
  })
})

test('non-binary (optional)', function(t) {
  var rp = path.join('test', 'fixtures', 'non-binary', 'two.md')

  return execa('./cli.js', [rp]).catch(function(error) {
    t.is(
      error.stderr,
      [
        rp,
        '   1:1-1:3  warning  `He` may be insensitive, use `They`, `It` instead   he-she  retext-equality',
        '  1:7-1:10  warning  `she` may be insensitive, use `they`, `it` instead  he-she  retext-equality',
        '',
        '⚠ 2 warnings'
      ].join('\n')
    )
  })
})

test('profanity (default)', function(t) {
  var rp = path.join('test', 'fixtures', 'profanity', 'two.md')

  return execa('./cli.js', [rp]).catch(function(error) {
    var expected = [
      rp,
      '  1:5-1:11  warning  Be careful with “beaver”, it’s profane in some cases  beaver  retext-profanities',
      '',
      '⚠ 1 warning'
    ].join('\n')

    t.is(error.stderr, expected)
  })
})

test('profanity (profanitySureness: 1)', function(t) {
  var rp = path.join('test', 'fixtures', 'profanity-sureness', 'two.md')

  return execa('./cli.js', [rp]).then(function(result) {
    t.is(result.stderr, rp + ': no issues found')
  })
})

test('default globs', function(t) {
  return execa('./cli.js').then(function(result) {
    t.is(
      result.stderr,
      'contributing.md: no issues found\nreadme.md: no issues found'
    )
  })
})
