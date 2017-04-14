/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module alex
 * @fileoverview
 *   alex checks your (or someone else’s) writing for possible
 *   inconsiderate wording.
 */

'use strict';

/* Dependencies. */
var VFile = require('vfile');
var unified = require('unified');
var markdown = require('remark-parse');
var english = require('retext-english');
var equality = require('retext-equality');
var profanities = require('retext-profanities');
var remark2retext = require('remark-retext');
var sort = require('vfile-sort');
var filter = require('./filter');

/* Expose. */
module.exports = alex;
alex.text = noMarkdown;
alex.markdown = alex;

/* Processor. */
var text = unified().use(english).use(equality).use(profanities);

/**
 * alex’s core.
 *
 * @param {string|VFile} value - Content.
 * @param {Processor} processor - retext or remark.
 * @return {VFile} - Result.
 */
function core(value, processor) {
  var file = new VFile(value);
  var tree = processor.parse(file);

  processor.runSync(tree, file);

  sort(file);

  return file;
}

/**
 * alex.
 *
 * Read markdown as input, converts to natural language,
 * then detect violations.
 *
 * @example
 *   alex('We’ve confirmed his identity.').messages;
 *   // [ { [1:17-1:20: `his` may be insensitive, use `their`, `theirs` instead]
 *   //   name: '1:17-1:20',
 *   //   file: '',
 *   //   reason: '`his` may be insensitive, use `their`, `theirs` instead',
 *   //   line: 1,
 *   //   column: 17,
 *   //   fatal: false } ]
 *
 * @param {string|VFile} value - Content.
 * @param {Array.<string>?} allow - Allowed rules.
 * @return {VFile} - Result.
 */
function alex(value, allow) {
  return core(value, unified()
    .use(markdown)
    .use(remark2retext, text)
    .use(filter, {allow: allow})
  );
}

/**
 * alex, without the markdown.
 *
 * @param {string|VFile} value - Content.
 * @return {VFile} - Result.
 */
function noMarkdown(value) {
  return core(value, text);
}
