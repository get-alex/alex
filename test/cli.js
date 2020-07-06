'use strict'

var path = require('path')
var childProcess = require('child_process')
var test = require('tape')

var pkg = require('../package')

test('alex-cli', function(t) {
  t.test('version', function(t) {
    t.plan(1)

    childProcess.exec('./cli.js -v', onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err, stderr, stdout],
        [null, '', pkg.version + '\n'],
        'should work'
      )
    }
  })

  t.test('help', function(t) {
    t.plan(1)

    childProcess.exec('./cli.js -h', onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err, stderr, /Usage: alex \[<glob> ...] /.test(stdout)],
        [null, '', true],
        'should work'
      )
    }
  })

  t.test('stdin', function(t) {
    t.plan(1)

    var subprocess = childProcess.exec('./cli.js --stdin', onexec)

    setTimeout(end, 10)

    function end() {
      subprocess.stdin.end('His')
    }

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err.code, stderr, stdout],
        [
          1,
          [
            '<stdin>',
            '  1:1-1:4  warning  `His` may be insensitive, when referring to a person, use `Their`, `Theirs`, `Them` instead  her-him  retext-equality',
            '',
            '⚠ 1 warning',
            ''
          ].join('\n'),
          ''
        ],
        'should work'
      )
    }
  })

  t.test('stdin and globs', function(t) {
    var fp = path.join('test', 'fixtures', 'one.md')

    t.plan(1)

    childProcess.exec('./cli.js --stdin ' + fp, onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err.code, /Do not pass globs with `--stdin`/.test(stderr), stdout],
        [1, true, ''],
        'should work'
      )
    }
  })

  t.test('markdown by default', function(t) {
    var fp = path.join('test', 'fixtures', 'one.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err, stderr, stdout],
        [null, fp + ': no issues found\n', ''],
        'should work'
      )
    }
  })

  t.test('optionally html', function(t) {
    var fp = path.join('test', 'fixtures', 'three.html')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' --html', onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err.code, /3 warnings/.test(stderr), stdout],
        [1, true, ''],
        'should work'
      )
    }
  })

  t.test('optionally text (on markdown)', function(t) {
    var fp = path.join('test', 'fixtures', 'one.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' --text', onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err.code, /1 warning/.test(stderr), stdout],
        [1, true, ''],
        'should work'
      )
    }
  })

  t.test('optionally text (on html)', function(t) {
    var fp = path.join('test', 'fixtures', 'three.html')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' --text', onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err.code, /10 warnings/.test(stderr), stdout],
        [1, true, ''],
        'should work'
      )
    }
  })

  t.test('successful', function(t) {
    var fp = path.join('test', 'fixtures', 'ok.txt')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err, stderr, stdout],
        [null, fp + ': no issues found\n', ''],
        'should work'
      )
    }
  })

  t.test('quiet (ok)', function(t) {
    var fp = path.join('test', 'fixtures', 'ok.txt')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' -q', onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual([err, stderr, stdout], [null, '', ''], 'should work')
    }
  })

  t.test('quiet (on error)', function(t) {
    var fp = path.join('test', 'fixtures', 'one.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' -q --text', onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err.code, stderr, stdout],
        [
          1,
          [
            fp,
            '  1:18-1:21  warning  `his` may be insensitive, when referring to a person, use `their`, `theirs`, `them` instead  her-him  retext-equality',
            '',
            '⚠ 1 warning',
            ''
          ].join('\n'),
          ''
        ],
        'should work'
      )
    }
  })

  t.test('binary (default: ok)', function(t) {
    var fp = path.join('test', 'fixtures', 'binary', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err, stderr, stdout],
        [null, fp + ': no issues found\n', ''],
        'should work'
      )
    }
  })

  t.test('binary (with config file)', function(t) {
    var fp = path.join('test', 'fixtures', 'non-binary', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err.code, stderr, stdout],
        [
          1,
          [
            fp,
            '   1:1-1:3  warning  `He` may be insensitive, use `They`, `It` instead   he-she  retext-equality',
            '  1:7-1:10  warning  `she` may be insensitive, use `they`, `it` instead  he-she  retext-equality',
            '',
            '⚠ 2 warnings',
            ''
          ].join('\n'),
          ''
        ],
        'should work'
      )
    }
  })

  t.test('profanity (default)', function(t) {
    var fp = path.join('test', 'fixtures', 'profanity', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err.code, stderr, stdout],
        [
          1,
          [
            fp,
            '  1:5-1:11  warning  Be careful with `beaver`, it’s profane in some cases  beaver  retext-profanities',
            '',
            '⚠ 1 warning',
            ''
          ].join('\n'),
          ''
        ],
        'should work'
      )
    }
  })

  t.test('profanity (with config file)', function(t) {
    var fp = path.join('test', 'fixtures', 'profanity-sureness', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err, stderr, stdout],
        [null, fp + ': no issues found\n', ''],
        'should work'
      )
    }
  })

  t.test('default globs', function(t) {
    t.plan(1)

    childProcess.exec('./cli.js', onexec)

    function onexec(err, stdout, stderr) {
      t.deepEqual(
        [err, stderr, stdout],
        [null, 'readme.md: no issues found\n', ''],
        'should work'
      )
    }
  })

  t.end()
})
