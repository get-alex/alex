import fs from 'fs'
import path from 'path'
import childProcess from 'child_process'
import test from 'tape'

const pkg = JSON.parse(fs.readFileSync('package.json'))

test('alex-cli', function (t) {
  t.test('version', function (t) {
    t.plan(1)

    childProcess.exec('./cli.js -v', onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error, stderr, stdout],
        [null, '', pkg.version + '\n'],
        'should work'
      )
    }
  })

  t.test('help', function (t) {
    t.plan(1)

    childProcess.exec('./cli.js -h', onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error, stderr, /Usage: alex \[<glob> ...] /.test(stdout)],
        [null, '', true],
        'should work'
      )
    }
  })

  t.test('stdin', function (t) {
    t.plan(1)

    var subprocess = childProcess.exec('./cli.js --stdin', onexec)

    setTimeout(end, 10)

    function end() {
      subprocess.stdin.end('His')
    }

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, stderr, stdout],
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

  t.test('stdin and globs', function (t) {
    var fp = path.join('test', 'fixtures', 'one.md')

    t.plan(1)

    childProcess.exec('./cli.js --stdin ' + fp, onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, /Do not pass globs with `--stdin`/.test(stderr), stdout],
        [1, true, ''],
        'should work'
      )
    }
  })

  t.test('markdown by default', function (t) {
    var fp = path.join('test', 'fixtures', 'one.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error, stderr, stdout],
        [null, fp + ': no issues found\n', ''],
        'should work'
      )
    }
  })

  t.test('optionally html', function (t) {
    var fp = path.join('test', 'fixtures', 'three.html')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' --html', onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, /3 warnings/.test(stderr), stdout],
        [1, true, ''],
        'should work'
      )
    }
  })

  t.test('optionally text (on markdown)', function (t) {
    var fp = path.join('test', 'fixtures', 'one.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' --text', onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, /1 warning/.test(stderr), stdout],
        [1, true, ''],
        'should work'
      )
    }
  })

  t.test('optionally text (on html)', function (t) {
    var fp = path.join('test', 'fixtures', 'three.html')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' --text', onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, /10 warnings/.test(stderr), stdout],
        [1, true, ''],
        'should work'
      )
    }
  })

  t.test('mdx', function (t) {
    var fp = path.join('test', 'fixtures')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' --mdx', onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, /2 warnings/.test(stderr), stdout],
        [1, true, ''],
        'should work'
      )
    }
  })

  t.test('successful', function (t) {
    var fp = path.join('test', 'fixtures', 'ok.txt')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error, stderr, stdout],
        [null, fp + ': no issues found\n', ''],
        'should work'
      )
    }
  })

  t.test('quiet (ok)', function (t) {
    var fp = path.join('test', 'fixtures', 'ok.txt')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' -q', onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual([error, stderr, stdout], [null, '', ''], 'should work')
    }
  })

  t.test('quiet (on error)', function (t) {
    var fp = path.join('test', 'fixtures', 'one.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp + ' -q --text', onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, stderr, stdout],
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

  t.test('binary (default: ok)', function (t) {
    var fp = path.join('test', 'fixtures', 'binary', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error, stderr, stdout],
        [null, fp + ': no issues found\n', ''],
        'should work'
      )
    }
  })

  t.test('binary (with config file)', function (t) {
    var fp = path.join('test', 'fixtures', 'non-binary', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, stderr, stdout],
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

  t.test('profanity (default)', function (t) {
    var fp = path.join('test', 'fixtures', 'profanity', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, stderr, stdout],
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

  t.test('profanity (with config file)', function (t) {
    var fp = path.join('test', 'fixtures', 'profanity-sureness', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error, stderr, stdout],
        [null, fp + ': no issues found\n', ''],
        'should work'
      )
    }
  })

  t.test('custom reporter', function (t) {
    var fp = path.join('test', 'fixtures', 'profanity-sureness', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js --reporter json ' + fp, onexec)

    const expectedJson = JSON.stringify([
      {
        path: fp,
        cwd: process.cwd(),
        history: [fp],
        messages: []
      }
    ])

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error, stdout, stderr],
        [null, '', expectedJson + '\n'],
        'should work'
      )
    }
  })

  t.test("custom formatter that isn't installed", function (t) {
    var fp = path.join('test', 'fixtures', 'profanity-sureness', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js --reporter doesntexist ' + fp, onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error, stderr, stdout],
        [null, 'Could not find reporter `doesntexist`\n', ''],
        'should work'
      )
    }
  })

  t.test('deny', function (t) {
    var fp = path.join('test', 'fixtures', 'deny', 'two.md')

    t.plan(1)

    childProcess.exec('./cli.js ' + fp, onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error.code, stderr, stdout],
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

  t.test('default globs', function (t) {
    t.plan(1)

    childProcess.exec('./cli.js', onexec)

    function onexec(error, stdout, stderr) {
      t.deepEqual(
        [error, stderr, stdout],
        [null, 'readme.md: no issues found\n', ''],
        'should work'
      )
    }
  })

  t.end()
})
