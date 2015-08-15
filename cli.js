#!/usr/bin/env node
'use strict';

/* eslint-disable no-console */

var meow = require('meow');
var getStdin = require('get-stdin');
var styl = require(require('eslint-stylish'));
var toFile = require('to-vfile');
var alex = require('./');

var expextPipeIn = !process.stdin.isTTY;

var cli = meow({
    'help': [
        'Usage:  alex [<file> ...]',
        '',
        'Examples',
        '  $ echo "His network looks good" | alex',
        '  $ alex example.txt',
        '  $ alex readme.md'
    ]
});

var input = cli.input;
var exit = 0;

/**
 * Log a virtual file processed by alex.
 *
 * @param {VFile} file - Virtual file.
 */
function log(file) {
    console.log(styl([file], /* work around stylish */ {
        'rules': {
            'undefined': [1]
        }
    }));

    if (!exit && file.hasFailed()) {
        exit = 1;
    }
}

if (expextPipeIn) {
    getStdin(function (value) {
        var file = toFile('<stdin>');
        file.contents = value;
        log(alex(file));
    });
} else if (!input.length) {
    cli.showHelp();
    return;
}

input.forEach(function (filePath) {
    toFile.read(filePath, function (err, file) {
        if (err) {
            throw err;
        }

        alex(file);

        log(file);
    });
});

/*
 * Exit.
 */

process.on('exit', function () {
    /* eslint-disable no-process-exit */
    process.exit(exit);
    /* eslint-enable no-process-exit */
});
