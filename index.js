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

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var VFile = require('vfile');
var remark = require('remark');
var retext = require('retext');
var english = require('retext-english');
var equality = require('retext-equality');
var remark2retext = require('remark-retext');
var sort = require('vfile-sort');

/*
 * Processor.
 */

var text = retext().use(english).use(equality);
var markdown = remark().use(remark2retext, text);

/**
 * Wrap the given processor.
 *
 * @param {Processor} processor - Remark or Retext.
 */
function factory(processor) {
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
     * @param {string|VFile} value - Content
     * @return {VFile} - Result.
     */
    return function (value) {
        var file = new VFile(value);

        processor.parse(file);
        processor.run(file);

        sort(file);

        return file;
    }
}

/*
 * Expose.
 */

var alex = factory(markdown);

alex.text = factory(text);
alex.markdown = alex;

module.exports = alex;
