/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer
 * @license MIT
 * @module alex:test
 * @fileoverview Test suite for alex.
 */

'use strict';

/* eslint-env node */

/*
 * Dependencies.
 */

var test = require('ava');
var alex = require('./');

/*
 * Tests. Note that these are small because alex is in fact
 * just a collection of well-tested modules.
 * See `wooorm/retext-equality` for the gist of what
 * warnings are exposed.
 */

test(function (t) {
    t.same(alex([
        'The boogeyman wrote all changes to the **master server**. Thus,',
        'the slaves were read-only copies of master. But not to worry,',
        'he was a cripple.'
    ].join('\n')).messages.map(String), [
        '1:5-1:14: `boogeyman` may be insensitive, use `boogey` instead',
        '1:42-1:48: `master` / `slaves` may be insensitive, use `primary` / `replica` instead',
        '3:1-3:3: `he` may be insensitive, use `they`, `it` instead',
        '3:10-3:17: `cripple` may be insensitive, use `person with a limp` instead'
    ]);

    t.end();
});
