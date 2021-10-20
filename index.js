import {VFile} from 'vfile'
import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import rehypeParse from 'rehype-parse'
import retextEnglish from 'retext-english'
import retextEquality from 'retext-equality'
import retextProfanities from 'retext-profanities'
import remarkRetext from 'remark-retext'
import rehypeRetext from 'rehype-retext'
import {sort} from 'vfile-sort'
import {filter} from './filter.js'

function makeText(config) {
  return unified()
    .use(retextEnglish)
    .use(retextEquality, {
      noBinary: config && config.noBinary
    })
    .use(retextProfanities, {
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

export default markdown

// Alex.
export function markdown(value, config) {
  return core(
    value,
    config,
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkRetext, makeText(config))
  )
}

// Alex, for MDX.
export function mdx(value, config) {
  return core(
    value,
    config,
    unified()
      .use(remarkParse)
      .use(remarkMdx)
      .use(remarkRetext, makeText(config))
  )
}

// Alex, for HTML.
export function html(value, config) {
  return core(
    value,
    config,
    unified().use(rehypeParse).use(rehypeRetext, makeText(config))
  )
}

// Alex, without the markdown.
export function text(value, config) {
  return core(value, config, makeText(config))
}
