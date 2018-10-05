'use strict'

var VFile = require('vfile')
var unified = require('unified')
var markdown = require('remark-parse')
var frontmatter = require('remark-frontmatter')
var html = require('rehype-parse')
var english = require('retext-english')
var equality = require('retext-equality')
var profanities = require('retext-profanities')
var remark2retext = require('remark-retext')
var rehype2retext = require('rehype-retext')
var sort = require('vfile-sort')
var filter = require('./filter')

module.exports = alex
alex.text = noMarkdown
alex.markdown = alex
alex.html = htmlParse

var text = unified()
  .use(english)
  .use(equality)
  .use(profanities)

// Alex’s core.
function core(value, processor) {
  var file = new VFile(value)
  var tree = processor.parse(file)

  processor.runSync(tree, file)

  sort(file)

  return file
}

// Alex.
function alex(value, allow) {
  return core(
    value,
    unified()
      .use(markdown)
      .use(frontmatter, ['yaml', 'toml'])
      .use(remark2retext, text)
      .use(filter, {allow: allow})
  )
}

// Alex, for HTML.
function htmlParse(value, allow) {
  return core(
    value,
    unified()
      .use(html)
      .use(rehype2retext, text)
      .use(filter, {allow: allow})
  )
}

// Alex, without the markdown.
function noMarkdown(value) {
  return core(value, text)
}
