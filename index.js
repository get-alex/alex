/**
 * @typedef {import('nlcst').Root} Root
 * @typedef {import('./filter.js').Options} FilterOptions
 *
 * @typedef {boolean|undefined} NoBinaryOption
 * @typedef {0|1|2|undefined} SurenessOption
 *
 * @typedef {{noBinary: NoBinaryOption, sureness: SurenessOption}} TextOptions
 *
 * @typedef {{noBinary?: NoBinaryOption, profanitySureness?: SurenessOption} & FilterOptions} OptionsObject
 * @typedef {import('vfile').VFileCompatible} Input
 * @typedef {OptionsObject|string[]|undefined} Options
 */

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

/** @param {TextOptions} options */
function makeText(options) {
  return unified()
    .use(retextEnglish)
    .use(retextEquality, options)
    .use(retextProfanities, options)
}

/**
 * Alex’s core.
 *
 * @param {Input} value
 * @param {FilterOptions} options
 * @param {import('unified').Processor<void, Root>} processor
 */
function core(value, options, processor) {
  const file = new VFile(value)
  const tree = processor.use(filter, options).parse(file)

  processor.runSync(tree, file)

  sort(file)

  return file
}

export default markdown

/**
 * Alex (markdown).
 *
 * @param {Input} value
 * @param {Options} [config]
 */
export function markdown(value, config) {
  const options = splitOptions(config)
  return core(
    value,
    options.filter,
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkRetext, makeText(options.text))
  )
}

/**
 * Alex (MDX).
 *
 * @param {Input} value
 * @param {Options} [config]
 */
export function mdx(value, config) {
  const options = splitOptions(config)
  return core(
    value,
    options.filter,
    unified()
      .use(remarkParse)
      .use(remarkMdx)
      .use(remarkRetext, makeText(options.text))
  )
}

/**
 * Alex (HTML).
 *
 * @param {Input} value
 * @param {Options} [config]
 */
export function html(value, config) {
  const options = splitOptions(config)
  return core(
    value,
    options.filter,
    unified().use(rehypeParse).use(rehypeRetext, makeText(options.text))
  )
}

/**
 * Alex (plain text).
 *
 * @param {Input} value
 * @param {Options} [config]
 */
export function text(value, config) {
  const options = splitOptions(config)
  return core(value, options.filter, makeText(options.text))
}

/**
 * @param {Options} options
 */
function splitOptions(options) {
  /** @type {string[]|undefined} */
  let allow
  /** @type {string[]|undefined} */
  let deny
  /** @type {boolean|undefined} */
  let noBinary
  /** @type {SurenessOption} */
  let sureness

  if (Array.isArray(options)) {
    allow = options
  } else if (options) {
    allow = options.allow
    deny = options.deny
    noBinary = options.noBinary
    sureness = options.profanitySureness
  }

  return {filter: {allow, deny}, text: {noBinary, sureness}}
}

function contentUsingPronouns() {
  const REMINDER_PROBABILITY = 0.1;
  if(Math.random() < REMINDER_PROBABILITY) {
    process.stdout.write.log("Friendly reminder: please ensure you are using the correct pronouns that people state they use.");
  }
 }
 