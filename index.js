import doc from 'global/document.js'
import win from 'global/window.js'
import createElement from 'virtual-dom/create-element.js'
import diff from 'virtual-dom/diff.js'
import patch from 'virtual-dom/patch.js'
import h from 'virtual-dom/h.js'
import debounce from 'debounce'
import {VFile} from 'vfile'
import {statistics} from 'vfile-statistics'
import {sort} from 'vfile-sort'
import {unified} from 'unified'
import retextEnglish from 'retext-english'
import retextEquality from 'retext-equality'
import retextProfanities from 'retext-profanities'

const own = {}.hasOwnProperty

const processor = unified()
  .use(retextEnglish)
  .use(retextEquality)
  .use(retextProfanities)
  .use(severity)

const root = doc.querySelector('#root')
let tree = render(doc.querySelector('template').innerHTML)
let dom = root.appendChild(createElement(tree))

function onchange(ev) {
  const next = render(ev.target.value)
  dom = patch(dom, diff(tree, next))
  tree = next
}

function resize() {
  dom.lastChild.rows = rows(dom.firstChild)
}

function render(text) {
  const file = new VFile(text)
  const tree = processor.parse(file)
  const change = debounce(onchange, 4)
  let key = 0

  processor.runSync(tree, file)

  setTimeout(resize, 4)

  return h('div', {className: 'document'}, [
    h('div', {key: 'draw', className: 'draw'}, pad(all(file))),
    h('div', {key: 'messages', className: 'messages'}, messages(file)),
    h('textarea', {
      key: 'area',
      value: text,
      oninput: change,
      onpaste: change,
      onkeyup: change,
      onmouseup: change
    })
  ])

  function all(file) {
    const offsets = getOffsets(file.messages)
    const results = []
    let index = -1
    let last = 0

    while (++index < offsets.length) {
      const offset = offsets[index]

      results.push(
        text.slice(last, offset[0]),
        h(
          'span.offense',
          {key: key++, className: offset[2] ? 'error' : 'warn'},
          text.slice(offset[0], offset[1])
        )
      )

      last = offset[1]
    }

    results.push(text.slice(last))

    return results
  }

  /* Trailing white-space in a `textarea` is shown, but not in a `div`
   * with `white-space: pre-wrap`. Add a `br` to make the last newline
   * explicit. */
  function pad(nodes) {
    const tail = nodes[nodes.length - 1]

    if (typeof tail === 'string' && tail.charAt(tail.length - 1) === '\n') {
      nodes.push(h('br', {key: 'break'}))
    }

    return nodes
  }

  function messages(file) {
    const messages = file.messages
    const stats = statistics(file)
    const results = []
    let index = -1

    while (++index < messages.length) {
      const message = messages[index]
      results[index] = h('li.issue', {key: index}, decorateMessage(message))
    }

    return [
      h('ol.issues', {className: messages.length > 0 ? '' : 'empty'}, results),
      h('.issue-summary', {key: 'summary'}, [
        h('span.filename', 'example.md'),
        h('span.counts', [
          h(
            'span.count',
            {className: stats.fatal ? 'error' : ''},
            String(stats.fatal)
          ),
          h(
            'span.count',
            {className: stats.nonfatal ? 'warn' : ''},
            String(stats.nonfatal)
          ),
          h('span.count', '0')
        ])
      ])
    ]
  }
}

function rows(node) {
  return (
    Math.ceil(
      node.getBoundingClientRect().height /
        Number.parseInt(win.getComputedStyle(node).lineHeight, 10)
    ) + 1
  )
}

function decorateMessage(message) {
  const value = message.reason
  const re = /[“`](.+?)[`”]/g
  const results = []
  const index = value.indexOf('use')
  let last = 0
  let match
  let sub

  while ((match = re.exec(value))) {
    sub = value.slice(last, re.lastIndex - match[0].length)

    if (sub) {
      results.push(sub)
    }

    let name = re.lastIndex > index ? 'ok' : 'nok'

    if (message.source === 'retext-profanities') {
      name = 'nok'
    }

    results.push(h('code.label.label-' + name, match[1]))

    last = re.lastIndex
  }

  sub = value.slice(last)

  if (sub) {
    results.push(sub)
  }

  return [h('span.source', message.name), h('span.line', results)]
}

function getOffsets(messages) {
  const map = {}
  const offsets = []
  let index = -1
  let previous

  /* Algorithm is a bit funky as the locations are sorted,
   * thus we can expect a lot to be true. */
  while (++index < messages.length) {
    const message = messages[index]
    const position = message.position || {}
    const start = position.start && position.start.offset
    const end = position.end && position.end.offset

    if (typeof start !== 'number' || typeof end !== 'number') {
      continue
    }

    if (previous && end < previous) {
      continue
    }

    previous = end

    if (start in map) {
      if (end > map[start]) {
        map[start] = {end, fatal: message.fatal}
      }
    } else {
      map[start] = {end, fatal: message.fatal}
    }
  }

  let key

  for (key in map) {
    if (own.call(map, key)) {
      offsets.push([Number(key), map[key].end, map[key].fatal])
    }
  }

  return offsets
}

function severity() {
  const map = {
    0: null,
    1: false,
    2: true,
    undefined: false
  }

  return transformer

  function transformer(tree, file) {
    let index = -1

    sort(file)

    while (++index < file.messages.length) {
      const message = file.messages[index]
      message.fatal = map[message.profanitySeverity]
    }
  }
}
