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
        'The `boogeyman` wrote all changes to the **master server**. Thus,',
        'the slaves were read-only copies of master. But not to worry,',
        'he was a _cripple_.',
        '',
        'Eric is pretty set on beating your butt for the sheriff.'
      ].join('\n')
    ).messages.map(String),
    [
      '1:44-1:50: `master` / `slaves` may be insensitive, use `primary` / `replica` instead',
      '2:5-2:11: Don’t use `slaves`, it’s profane',
      '3:1-3:3: `he` may be insensitive, use `they`, `it` instead',
      '3:11-3:18: `cripple` may be insensitive, use `person with a limp` instead',
      '5:36-5:40: Be careful with `butt`, it’s profane in some cases'
    ],
    'should work'
  )

  t.deepEqual(
    alex(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      ['butt']
    ).messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:31-1:37: Don’t use `asshat`, it’s profane'
    ],
    'should work with allow array'
  )

  t.deepEqual(
    alex(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {allow: ['butt']}
    ).messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:31-1:37: Don’t use `asshat`, it’s profane'
    ],
    'should work with allow config'
  )

  t.deepEqual(
    alex(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {
        profanitySureness: 1
      }
    ).messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:31-1:37: Don’t use `asshat`, it’s profane'
    ],
    'should work with profanity config'
  )

  t.deepEqual(
    alex(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {
        allow: ['asshat'],
        profanitySureness: 1
      }
    ).messages.map(String),
    ['1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead'],
    'should work with allow and profanity config'
  )

  t.deepEqual(alex.markdown, alex, 'alex.markdown is an alias of alex')

  t.deepEqual(
    alex
      .text(
        [
          'The `boogeyman` wrote all changes to the **master server**. Thus,',
          'the slaves were read-only copies of master. But not to worry,',
          'he was a _cripple_.',
          '',
          'Eric is pretty set on beating your butt for the sheriff.'
        ].join('\n')
      )
      .messages.map(String),
    [
      '1:6-1:15: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:44-1:50: `master` / `slaves` may be insensitive, use ' +
        '`primary` / `replica` instead',
      '2:5-2:11: Don’t use `slaves`, it’s profane',
      '3:1-3:3: `he` may be insensitive, use `they`, `it` instead',
      '3:11-3:18: `cripple` may be insensitive, use `person with a ' +
        'limp` instead',
      '5:36-5:40: Be careful with `butt`, it’s profane in some cases'
    ],
    'alex.text()'
  )

  t.deepEqual(
    alex
      .text(
        'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
        ['butt']
      )
      .messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:31-1:37: Don’t use `asshat`, it’s profane'
    ],
    'alex.text() with allow array'
  )

  t.deepEqual(
    alex
      .text(
        'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
        {allow: ['butt']}
      )
      .messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:31-1:37: Don’t use `asshat`, it’s profane'
    ],
    'alex.text() with allow config'
  )

  t.deepEqual(
    alex
      .text(
        'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
        {profanitySureness: 1}
      )
      .messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:31-1:37: Don’t use `asshat`, it’s profane'
    ],
    'alex.text() with profanity config'
  )

  t.deepEqual(
    alex
      .text(
        'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
        {
          allow: ['asshat'],
          profanitySureness: 1
        }
      )
      .messages.map(String),
    ['1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead'],
    'alex.text() with allow and profanity config'
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
    alex.html(html, ['butt']).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead'
    ],
    'alex.html() with allow array'
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
    alex.html(html, {profanitySureness: 1}).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead'
    ],
    'alex.html() with profanity config'
  )

  t.deepEqual(
    alex
      .html(html, {
        allow: ['he-she'],
        profanitySureness: 1
      })
      .messages.map(String),
    [],
    'alex.html() with allow and profantity config'
  )

  t.end()
})
