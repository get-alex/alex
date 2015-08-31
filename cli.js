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
        'Examples',
        '  $ echo "His network looks good" | alex',
        '  $ alex *.{txt,md}'
    ]
});

notifier({
    'pkg': pack
}).notify();

var input = cli.input;
var exit = 0;

var result = [];

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

globby(input).then(function (filePaths) {
    filePaths.forEach(function (filePath) {
        toFile.read(filePath, function (err, file) {
            bail(err);

            alex(file);

            log(file);
        });
    });
}, bail);

/*
 * Exit.
 */

process.on('exit', function () {
    console.log(format(result));

    /* eslint-disable no-process-exit */
    process.exit(exit);
    /* eslint-enable no-process-exit */
});
