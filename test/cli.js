'use strict'

var path = require('path')
var test = require('ava')
var execa = require('execa')

test('version', async function(t) {
  var result = await execa('./cli.js', ['-v'])
  t.is(result.stdout, require('../package').version)
})

test('help', async function(t) {
  var result = await execa('./cli.js', ['-h'])
  t.regex(result.stdout, /Usage: alex \[<glob> ...] /)
})

test('stdin', async function(t) {
  try {
    await execa('./cli.js', ['--stdin'], {input: 'His'})
  } catch (error) {
    t.is(
      error.stderr,
      [
        '<stdin>',
        '  1:1-1:4  warning  `His` may be insensitive, when referring to a person, use `Their`, `Theirs`, `Them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning'
      ].join('\n')
    )
  }
})

test('stdin and globs', async function(t) {
  var filePath = path.join('test', 'fixtures', 'one.md')

  try {
    await execa('./cli.js', ['--stdin', filePath])
  } catch (error) {
    t.regex(error.stderr, /Do not pass globs with `--stdin`/)
  }
})

test('markdown by default', async function(t) {
  var filePath = path.join('test', 'fixtures', 'one.md')
  var result = await execa('./cli.js', [filePath])

  t.is(result.stderr, filePath + ': no issues found')
})

test('text optional', async function(t) {
  var filePath = path.join('test', 'fixtures', 'one.md')

  try {
    await execa('./cli.js', [filePath, '--text'])
  } catch (error) {
    t.is(
      error.stderr,
      [
        filePath,
        '  1:18-1:21  warning  `his` may be insensitive, when referring to a person, use `their`, `theirs`, `them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning'
      ].join('\n')
    )
  }
})

test('text on html', async function(t) {
  var filePath = path.join('test', 'fixtures', 'three.html')

  try {
    await execa('./cli.js', [filePath, '--text'])
  } catch (error) {
    t.regex(error.stderr, /9 warnings/)
  }
})

test('html optional', async function(t) {
  var filePath = path.join('test', 'fixtures', 'three.html')

  try {
    await execa('./cli.js', [filePath, '--html'])
  } catch (error) {
    t.is(
      error.stderr,
      [
        filePath,
        '  9:18-9:20  warning  `He` may be insensitive, use `They`, `It` instead   he-she  retext-equality',
        '  10:1-10:4  warning  `She` may be insensitive, use `They`, `It` instead  he-she  retext-equality',
        '',
        '⚠ 2 warnings'
      ].join('\n')
    )
  }
})

test('successful files', async function(t) {
  var filePath = path.join('test', 'fixtures', 'ok.txt')
  var result = await execa('./cli.js', [filePath])

  t.is(result.stderr, filePath + ': no issues found')
})

test('quiet on ok files', async function(t) {
  var fp = path.join(__dirname, 'fixtures', 'ok.txt')
  var result = await execa('./cli.js', [fp, '-q'])

  t.is(result.stderr, '')
})

test('quiet on nok files', async function(t) {
  var filePath = path.join('test', 'fixtures', 'one.md')

  try {
    await execa('./cli.js', [filePath, '--text'])
  } catch (error) {
    t.is(
      error.stderr,
      [
        filePath,
        '  1:18-1:21  warning  `his` may be insensitive, when referring to a person, use `their`, `theirs`, `them` instead  her-him  retext-equality',
        '',
        '⚠ 1 warning'
      ].join('\n')
    )
  }
})

test('binary (default)', async function(t) {
  var filePath = path.join('test', 'fixtures', 'binary', 'two.md')
  var result = await execa('./cli.js', [filePath])

  t.is(result.stderr, filePath + ': no issues found')
})

test('non-binary (optional)', async function(t) {
  var filePath = path.join('test', 'fixtures', 'non-binary', 'two.md')

  try {
    await execa('./cli.js', [filePath])
  } catch (error) {
    t.is(
      error.stderr,
      [
        filePath,
        '   1:1-1:3  warning  `He` may be insensitive, use `They`, `It` instead   he-she  retext-equality',
        '  1:7-1:10  warning  `she` may be insensitive, use `they`, `it` instead  he-she  retext-equality',
        '',
        '⚠ 2 warnings'
      ].join('\n')
    )
  }
})

test('profanity (default)', async function(t) {
  var filePath = path.join('test', 'fixtures', 'profanity', 'two.md')

  try {
    await execa('./cli.js', [filePath])
  } catch (error) {
    var expected = [
      filePath,
      '  1:5-1:11  warning  Be careful with `beaver`, it’s profane in some cases  beaver  retext-profanities',
      '',
      '⚠ 1 warning'
    ].join('\n')

    t.is(error.stderr, expected)
  }
})

test('profanity (profanitySureness: 1)', async function(t) {
  var filePath = path.join('test', 'fixtures', 'profanity-sureness', 'two.md')
  var result = await execa('./cli.js', [filePath])

  t.is(result.stderr, filePath + ': no issues found')
})

test('default globs', async function(t) {
  var result = await execa('./cli.js')

  t.is(
    result.stderr,
    'contributing.md: no issues found\nreadme.md: no issues found'
  )
})
