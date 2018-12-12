'use strict'

var fs = require('fs')
var path = require('path')
var test = require('ava')
var alex = require('..')

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
      '1:5-1:14: `boogeyman` may be insensitive, use `boogey` instead',
      '1:42-1:48: `master` / `slaves` may be insensitive, use ' +
        '`primary` / `replica` instead',
      '2:5-2:11: Don’t use “slaves”, it’s profane',
      '3:1-3:3: `he` may be insensitive, use `they`, `it` instead',
      '3:10-3:17: `cripple` may be insensitive, use `person with a ' +
        'limp` instead',
      '5:36-5:40: Be careful with “butt”, it’s profane in some cases'
    ]
  )
})

test('alex() with profantity config', function(t) {
  let {messages} = alex(
    'Eric, the asshat, is pretty set on beating your butt for sheriff.',
    {
      allow: ['asshat'],
      profanities: {
        sureness: 1
      }
    }
  )
  t.is(messages.length, 0, 'We dont expect any messages')
})

test('alex.markdown()', function(t) {
  t.deepEqual(alex.markdown('The `boogeyman`.').messages.map(String), [])
})

test('alex.text()', function(t) {
  t.deepEqual(alex.text('The `boogeyman`.').messages.map(String), [
    '1:6-1:15: `boogeyman` may be insensitive, use `boogey` instead'
  ])
})

test('alex.html()', function(t) {
  var fp = path.join(__dirname, 'fixtures', 'three.html')
  var fixture = fs.readFileSync(fp)

  t.deepEqual(alex.html(fixture).messages.map(String), [
    '9:18-9:20: `He` may be insensitive, use `They`, `It` instead',
    '10:1-10:4: `She` may be insensitive, use `They`, `It` instead'
  ])
})
