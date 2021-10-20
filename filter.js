/**
 * @typedef {import('mdast').Root} Root
 *
 * @typedef Options
 *   Configuration.
 * @property {string[]} [deny]
 *   The `deny` field should be an array of rules or `undefined` (the default is
 *   `undefined`).
 *   When provided, *only* the rules specified are reported.
 *   You cannot use both `allow` and `deny` at the same time.
 * @property {string[]} [allow]
 *   The `allow` field should be an array of rules or `undefined` (the default
 *   is `undefined`).
 *   When provided, the rules specified are skipped and not reported.
 *   You cannot use both `allow` and `deny` at the same time.
 */

import remarkMessageControl from 'remark-message-control'

/** @type {import('unified').Plugin<[Options?]|[], Root>} */
export function filter(options = {}) {
  if (options.allow && options.deny) {
    throw new Error(
      'Do not provide both allow and deny configuration parameters'
    )
  }

  return remarkMessageControl({
    name: 'alex',
    reset: Boolean(options.deny),
    enable: options.deny,
    disable: options.allow,
    source: ['retext-equality', 'retext-profanities']
  })
}
