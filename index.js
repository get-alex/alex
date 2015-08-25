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
const $highlight = document.getElementById('highlight');
const $issues = document.getElementById('issues');
const $noIssues = document.getElementById('no-issues');

function decorateMessage(message) {
    let value = message.reason;
    let index = value.indexOf('use');

    return value.replace(/`(.+?)`/g, function ($0, $1, position) {
        let name = position > index ? 'ok' : 'nok';
        return '<code class="label label-' + name + '">' + $1 + '</code>';
    });
}

function getOffsets(messages) {
    const length = messages.length;
    const map = {};
    const offsets = [];
    let index = -1;
    let position;
    let start;
    let end;
    let key;
    let prev;

    /*
     * Algorithm is a bit funky as the locations are sorted,
     * thus we can expect a lot to be true.
     */

    while (++index < length) {
        position = messages[index].location || {};
        start = position.start && position.start.offset;
        end = position.end && position.end.offset;

        if (isNaN(start) || isNaN(end)) {
            continue;
        }

        if (prev && end < prev) {
            continue;
        }

        prev = end;

        if (start in map) {
            if (end > map[start]) {
                map[start] = end;
            }
        } else {
            map[start] = end;
        }
    }

    for (key in map) {
        offsets.push([Number(key), map[key]]);
    }

    return offsets;
}

function decorateContent(content, messages) {
    const offsets = getOffsets(messages);
    const length = offsets.length;
    let $fragment = document.createDocumentFragment();
    let index = -1;
    let last = 0;
    let offset;
    let value;
    let warning;
    let $warning;

    while (++index < length) {
        offset = offsets[index];

        $fragment.appendChild(document.createTextNode(
            content.slice(last, offset[0])
        ));

        $warning = document.createElement('span');
        $warning.className = 'offense';
        $warning.appendChild(document.createTextNode(
            content.slice(offset[0], offset[1])
        ));

        $fragment.appendChild($warning);

        last = offset[1];
    }

    $fragment.appendChild(document.createTextNode(content.slice(last)));

    return $fragment;
}

function removeChildren($node) {
    let $head;

    while ($head = $node.firstChild) {
        $node.removeChild($head);
    }
}

let previousValue = '';

/**
 * Change.
 */
function onchange() {
    const value = $input.value;
    let messages;
    let index;
    let length;
    let $fragment;
    let $item;
    let $head;
    let message;

    if (value !== previousValue) {
        previousValue = value;
        messages = alex(value).messages;
        index = -1;
        length = messages.length
        $fragment = document.createDocumentFragment();

        $noIssues.setAttribute('style', length ? 'display:none' : '');
        $issues.setAttribute('style', !length ? 'display:none' : '');

        $highlight.setAttribute('style', 'opacity:0');
        removeChildren($highlight);

        $highlight.appendChild(decorateContent(value, messages));
        $highlight.setAttribute('style', '');

        removeChildren($issues);

        while (++index < length) {
            message = messages[index];
            $item = document.createElement('li');
            $item.className = 'issue';
            $item.source = message.toString();
            $item.innerHTML = decorateMessage(message);

            $fragment.appendChild($item);
        }

        $issues.appendChild($fragment);
    }

    $highlight.scrollTop = $input.scrollTop;
    $highlight.style.opacity = '';
}

function onstart() {
    if (
        $input.value !== previousValue ||
        $highlight.scrollTop !== $input.scrollTop
    ) {
        $highlight.style.opacity = '0';
    }
}

const end = debounce(onchange, 300);
const start = debounce(onstart, 100, true);

[
    'change',
    'onpropertychange',
    'input',
    'keydown',
    'click',
    'focus',
    'scroll'
].forEach(function (name) {
    events.bind($input, name, start);
    events.bind($input, name, end);
});

onchange();
