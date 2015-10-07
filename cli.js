#!/usr/bin/env node
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module alex
 * @fileoverview CLI for alex.
 */

'use strict';

/* eslint-env node */
/* eslint-disable no-console */

/*
 * Dependencies.
 */

var bail = require('bail');
var notifier = require('update-notifier');
var meow = require('meow');
var globby = require('globby');
var getStdin = require('get-stdin');
var format = require('vfile-reporter');
var toFile = require('to-vfile');
var alex = require('./');
var pack = require('./package');

/*
 * Constants.
 */

var expextPipeIn = !process.stdin.isTTY;

/*
 * Update messages.
 */

notifier({
    'pkg': pack
}).notify();

/*
 * Set-up meow.
 */

var cli = meow({
    'help': [
        'Usage:  alex [<file> ...] [-w, --why] [-t, --text]',
        '',
        'Options:',
        '',
        '  -w, --why    output more info regarding why things might be ' +
        'offensive',
        '  -t, --text   treat input as plain-text (not markdown)',
        '',
        'When no input files are given, searches for markdown and text',
        'files in the current directory, `doc`, and `docs`.',
        '',
        'Examples',
        '  $ echo "His network looks good" | alex',
        '  $ alex *.md !example.md',
        '  $ alex'
    ]
});

/*
 * Set-up.
 */

var exit = 0;
var result = [];
var why = Boolean(cli.flags.w || cli.flags.why);
var fn = Boolean(cli.flags.t || cli.flags.text) ? 'text' : 'markdown'
var input = cli.input.length ? cli.input : [
    '{docs/**/,doc/**/,}*.{md,markdown,mkd,mkdn,mkdown,ron,txt,text}'
];

/*
 * Exit.
 */

process.on('exit', function () {
    console.log(format(result, {
        'verbose': why
    }));

    process.exit(exit);
});

/**
 * Log a virtual file processed by alex.
 *
 * @param {VFile} file - Virtual file.
 */
function log(file) {
    result.push(file);

    if (!exit && file.messages.length) {
        exit = 1;
    }
}

/*
 * Handle stdin(4).
 */

if (!cli.input.length && expextPipeIn) {
    getStdin().then(function (value) {
        var file = toFile('<stdin>');

        file.contents = value;

        alex(file);

        log(file);
    }, bail);

    return;
}

/*
 * Handle patterns.
 */

globby(input).then(function (filePaths) {
    filePaths.forEach(function (filePath) {
        toFile.read(filePath, function (err, file) {
            bail(err);

            alex[fn](file);

            log(file);
        });
    });
}, bail);
