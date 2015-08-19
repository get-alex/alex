'use strict';

/*
 * Dependencies.
 */

const alex = require('wooorm/alex');
const debounce = require('component/debounce');
const events = require('component/event');

/*
 * Nodes.
 */

const $input = document.getElementsByTagName('textarea')[0];
const $issues = document.getElementById('issues');
const $noIssues = document.getElementById('no-issues');

function decorate(message) {
    let value = message.reason;
    let index = value.indexOf('use');

    return value.replace(/`(.+?)`/g, function ($0, $1, position) {
        let name = position > index ? 'ok' : 'nok';
        return '<code class="' + name + '">' + $1 + '</code>';
    });
}

var cache = {};

/**
 * Change.
 */
function onchange() {
    var messages = alex($input.value).messages;
    var index = -1;
    var length = messages.length
    var $fragment = document.createDocumentFragment();
    var $item;
    var $head;
    var message;

    $noIssues.setAttribute('style', length ? 'display:none' : '');
    $issues.setAttribute('style', !length ? 'display:none' : '');

    while ($head = $issues.firstChild) {
        if ($head.source) {
            cache[$head.source] = $head;
        }

        $issues.removeChild($head);
    }

    while (++index < length) {
        message = messages[index];
        $item = cache[message];

        if ($item) {
            cache[message] = null;
        } else {
            $item = document.createElement('li');
            $item.className = 'issue';
            $item.source = message.toString();
            $item.innerHTML = decorate(message);
        }

        $fragment.appendChild($item);
    }

    $issues.appendChild($fragment);
}

const debouncedChange = debounce(onchange, 100);

events.bind($input, 'change', debouncedChange);
events.bind($input, 'onpropertychange', debouncedChange);
events.bind($input, 'input', debouncedChange);

onchange();
