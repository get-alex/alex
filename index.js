'use strict'

var VFile = require('vfile')
var unified = require('unified')
var markdown = require('remark-parse')
var frontmatter = require('remark-frontmatter')
var mdx = require('remark-mdx')
var html = require('rehype-parse')
var english = require('retext-english')
var equality = require('retext-equality')
var profanities = require('retext-profanities')
var remark2retext = require('remark-retext')
var rehype2retext = require('rehype-retext')
var sort = require('vfile-sort')
var filter = require('./filter.js')

module.exports = alex
alex.text = noMarkdown
alex.markdown = alex
alex.mdx = mdxParse
alex.html = htmlParse

function makeText(config) {
  return unified()
    .use(english)
    .use(equality, {
      noBinary: config && config.noBinary
    })
    .use(profanities, {
      sureness: config && config.profanitySureness
    })
}

// Alex’s core.
function core(value, config, processor) {
  var allow
  var deny

  if (Array.isArray(config)) {
    allow = config
  } else if (config) {
    allow = config.allow
    deny = config.deny
  }

  var file = new VFile(value)
  var tree = processor.use(filter, {allow: allow, deny: deny}).parse(file)

  processor.runSync(tree, file)

  sort(file)

  return file
}

// Alex.
function alex(value, config) {
  return core(
    value,
    config,
    unified()
      .use(markdown)
      .use(frontmatter, ['yaml', 'toml'])
      .use(remark2retext, makeText(config))
  )
}

// Alex, for MDX.
function mdxParse(value, config) {
  return core(
    value,
    config,
    unified().use(markdown).use(mdx).use(remark2retext, makeText(config))
  )
}

// Alex, for HTML.
function htmlParse(value, config) {
  return core(
    value,
    config,
    unified().use(html).use(rehype2retext, makeText(config))
  )
}

// Alex, without the markdown.
function noMarkdown(value, config) {
  return core(value, config, makeText(config))
}
