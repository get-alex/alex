'use strict'

var fs = require('fs')
var path = require('path')
var test = require('tape')
var alex = require('..')

var html = fs.readFileSync(path.join(__dirname, 'fixtures', 'three.html'))

// Tests. Note that these are small because alex is in fact
// just a collection of well-tested modules.
// See `retextjs/retext-equality` for the gist of what
// warnings are exposed.
test('alex()', function(t) {
  t.deepEqual(
    alex(
      [
        'The boogeyman wrote all changes to the **master server**. Thus,',
        'the slaves were read-only copies of master. But not to worry,',
        'he was a cripple.',
        '',
        'Eric is pretty set on beating your butt for sheriff.'
      ].join('\n')
    ).messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:42-1:48: `master` / `slaves` may be insensitive, use ' +
        '`primary` / `replica` instead',
      '2:5-2:11: Don’t use `slaves`, it’s profane',
      '3:1-3:3: `he` may be insensitive, use `they`, `it` instead',
      '3:10-3:17: `cripple` may be insensitive, use `person with a ' +
        'limp` instead',
      '5:36-5:40: Be careful with `butt`, it’s profane in some cases'
    ],
    'should work'
  )

  t.deepEqual(
    alex('Eric is pretty set on beating your butt for sheriff.', ['butt'])
      .messages,
    [],
    'should work with an allow array'
  )

  t.deepEqual(
    alex('Eric, the asshat, is pretty set on beating your butt for sheriff.', {
      allow: ['asshat'],
      profanitySureness: 1
    }).messages,
    [],
    'should work with profantity config'
  )

  t.deepEqual(
    alex.markdown('The `boogeyman`.').messages.map(String),
    [],
    'alex.markdown()'
  )

  t.deepEqual(
    alex
      .text(
        [
          'The `boogeyman` wrote all changes to the **master server**. Thus,',
          'Eric is pretty set on beating your butt for sheriff.'
        ].join('\n')
      )
      .messages.map(String),
    [
      '1:6-1:15: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '2:36-2:40: Be careful with `butt`, it’s profane in some cases'
    ],
    'alex.text()'
  )

  t.deepEqual(
    alex
      .text(
        [
          'The `boogeyman` wrote all changes to the **master server**. Thus,',
          'Eric is pretty set on beating your butt for sheriff.'
        ].join('\n'),
        {allow: ['butt']}
      )
      .messages.map(String),
    ['1:6-1:15: `boogeyman` may be insensitive, use `boogeymonster` instead'],
    'alex.text() with allow config'
  )

  t.deepEqual(
    alex
      .text(
        [
          'The `boogeyman` wrote all changes to the **master server**. Thus,',
          'Eric is pretty set on beating your butt for sheriff.'
        ].join('\n'),
        ['butt']
      )
      .messages.map(String),
    ['1:6-1:15: `boogeyman` may be insensitive, use `boogeymonster` instead'],
    'alex.text() with allow array'
  )

  t.deepEqual(
    alex.html(html).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead',
      '18:61-18:65: Be careful with `butt`, it’s profane in some cases'
    ],
    'alex.html()'
  )

  t.deepEqual(
    alex.html(html, {allow: ['butt']}).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead'
    ],
    'alex.html() with allow config'
  )

  t.deepEqual(
    alex.html(html, ['butt']).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead'
    ],
    'alex.html() with allow array'
  )

  t.end()
})
