import fs from 'node:fs'
import test from 'tape'
import alex, {markdown, mdx, text, html} from '../index.js'

const threeHtml = fs.readFileSync(
  new URL('./fixtures/three.html', import.meta.url)
)
const fourMdx = fs.readFileSync(new URL('./fixtures/four.mdx', import.meta.url))

// Tests. Note that these are small because alex is in fact
// just a collection of well-tested modules.
// See `retextjs/retext-equality` for the gist of what
// warnings are exposed.
test('alex()', function (t) {
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
      '1:44-1:50: `master` may be insensitive, use `primary`, `hub`, `reference` instead',
      '2:5-2:11: Don’t use `slaves`, it’s profane',
      '2:37-2:43: `master` may be insensitive, use `primary`, `hub`, `reference` instead',
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
        deny: ['butt']
      }
    ).messages.map(String),
    ['1:52-1:56: Be careful with `butt`, it’s profane in some cases'],
    'should work with deny config'
  )

  t.throws(function () {
    alex(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {
        allow: ['asshat'],
        deny: ['boogeyman-boogeywoman']
      }
    )
  }, 'should throw an error with allow and deny config')

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

  t.deepEqual(
    alex(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {
        deny: ['boogeyman-boogeywoman'],
        profanitySureness: 1
      }
    ).messages.map(String),
    ['1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead'],
    'should work with deny and profanity config'
  )

  t.deepEqual(markdown, alex, 'markdown is an alias of alex')

  t.deepEqual(
    text(
      [
        'The `boogeyman` wrote all changes to the **master server**. Thus,',
        'the slaves were read-only copies of master. But not to worry,',
        'he was a _cripple_.',
        '',
        'Eric is pretty set on beating your butt for the sheriff.'
      ].join('\n')
    ).messages.map(String),
    [
      '1:6-1:15: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:44-1:50: `master` may be insensitive, use `primary`, `hub`, `reference` instead',
      '2:5-2:11: Don’t use `slaves`, it’s profane',
      '2:37-2:43: `master` may be insensitive, use `primary`, `hub`, `reference` instead',
      '3:1-3:3: `he` may be insensitive, use `they`, `it` instead',
      '3:11-3:18: `cripple` may be insensitive, use `person with a limp` instead',
      '5:36-5:40: Be careful with `butt`, it’s profane in some cases'
    ],
    'text()'
  )

  t.deepEqual(
    text(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      ['butt']
    ).messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:31-1:37: Don’t use `asshat`, it’s profane'
    ],
    'text() with allow array'
  )

  t.deepEqual(
    text(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {allow: ['butt']}
    ).messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:31-1:37: Don’t use `asshat`, it’s profane'
    ],
    'text() with allow config'
  )

  t.deepEqual(
    text(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {
        deny: ['butt']
      }
    ).messages.map(String),
    ['1:52-1:56: Be careful with `butt`, it’s profane in some cases'],
    'text() with deny config'
  )

  t.throws(function () {
    text(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {
        allow: ['asshat'],
        deny: ['boogeyman-boogeywoman']
      }
    )
  }, 'text() with allow and deny config')

  t.deepEqual(
    text(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {profanitySureness: 1}
    ).messages.map(String),
    [
      '1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead',
      '1:31-1:37: Don’t use `asshat`, it’s profane'
    ],
    'text() with profanity config'
  )

  t.deepEqual(
    text(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {
        allow: ['asshat'],
        profanitySureness: 1
      }
    ).messages.map(String),
    ['1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead'],
    'text() with allow and profanity config'
  )

  t.deepEqual(
    text(
      'The boogeyman asked Eric, the asshat, to beat your butt for the sheriff.',
      {
        deny: ['boogeyman-boogeywoman'],
        profanitySureness: 1
      }
    ).messages.map(String),
    ['1:5-1:14: `boogeyman` may be insensitive, use `boogeymonster` instead'],
    'text() with deny and profanity config'
  )

  t.deepEqual(
    html(threeHtml).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead',
      '18:36-18:42: Don’t use `asshat`, it’s profane',
      '18:74-18:78: Be careful with `butt`, it’s profane in some cases'
    ],
    'html()'
  )

  t.deepEqual(
    html(threeHtml, ['butt']).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead',
      '18:36-18:42: Don’t use `asshat`, it’s profane'
    ],
    'html() with allow array'
  )

  t.deepEqual(
    html(threeHtml, {allow: ['butt']}).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead',
      '18:36-18:42: Don’t use `asshat`, it’s profane'
    ],
    'html() with allow config'
  )

  t.deepEqual(
    html(threeHtml, {
      deny: ['butt']
    }).messages.map(String),
    ['18:74-18:78: Be careful with `butt`, it’s profane in some cases'],
    'html() with deny config'
  )

  t.throws(function () {
    html(threeHtml, {
      allow: ['he-she'],
      deny: ['butt']
    })
  }, 'html() with allow and deny config')

  t.deepEqual(
    html(threeHtml, {profanitySureness: 1}).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead',
      '18:36-18:42: Don’t use `asshat`, it’s profane'
    ],
    'html() with profanity config'
  )

  t.deepEqual(
    html(threeHtml, {
      allow: ['he-she'],
      profanitySureness: 1
    }).messages.map(String),
    ['18:36-18:42: Don’t use `asshat`, it’s profane'],
    'html() with allow and profanity config'
  )

  t.deepEqual(
    html(threeHtml, {
      deny: ['he-she'],
      profanitySureness: 1
    }).messages.map(String),
    [
      '17:22-17:24: `He` may be insensitive, use `They`, `It` instead',
      '18:5-18:8: `She` may be insensitive, use `They`, `It` instead'
    ],
    'html() with deny and profanity config'
  )

  t.deepEqual(
    mdx(fourMdx).messages.map(String),
    [
      '3:1-3:4: `She` may be insensitive, use `They`, `It` instead',
      '3:32-3:38: Don’t use `asshat`, it’s profane',
      '3:70-3:74: Be careful with `butt`, it’s profane in some cases'
    ],
    'mdx()'
  )

  t.deepEqual(
    mdx(fourMdx, ['butt']).messages.map(String),
    [
      '3:1-3:4: `She` may be insensitive, use `They`, `It` instead',
      '3:32-3:38: Don’t use `asshat`, it’s profane'
    ],
    'mdx() with options'
  )

  t.end()
})
