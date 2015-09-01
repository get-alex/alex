#!/usr/bin/env node
'use strict';

/* eslint-disable no-console */

var bail = require('bail');
var notifier = require('update-notifier');
var meow = require('meow');
var globby = require('globby');
var getStdin = require('get-stdin');
var format = require('vfile-reporter');
var toFile = require('to-vfile');
var alex = require('./');
var pack = require('./package');

var expextPipeIn = !process.stdin.isTTY;

var cli = meow({
    'help': [
        'Usage:  alex [<file> ...]',
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

notifier({
    'pkg': pack
}).notify();

var exit = 0;
var result = [];
var input = cli.input.length ? cli.input : [
    '*.{md,markdown,mkd,mkdn,mkdown,ron,txt,text}',
    'doc/**/*.{md,markdown,mkd,mkdn,mkdown,ron,txt,text}',
    'docs/**/*.{md,markdown,mkd,mkdn,mkdown,ron,txt,text}'
];

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
 * Exit.
 */

process.on('exit', function () {
    console.log(format(result));

    /* eslint-disable no-process-exit */
    process.exit(exit);
    /* eslint-enable no-process-exit */
});

if (expextPipeIn) {
    getStdin().then(function (value) {
        var file = toFile('<stdin>');

        file.contents = value;

        alex(file);

        log(file);
    }, bail);

    return;
}

globby(input).then(function (filePaths) {
    filePaths.forEach(function (filePath) {
        toFile.read(filePath, function (err, file) {
            bail(err);

            alex(file);

            log(file);
        });
    });
}, bail);
