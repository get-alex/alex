<!--lint disable no-html-->

<h1 align="center">
    <br>
    <img width="400" src="./logo.svg" alt="alex">
    <br>
</h1>

>   📝 **alex** — Catch insensitive, inconsiderate writing.

[![Build Status](https://img.shields.io/travis/wooorm/alex.svg)](https://travis-ci.org/wooorm/alex) [![Coverage Status](https://img.shields.io/codecov/c/github/wooorm/alex.svg)](https://codecov.io/github/wooorm/alex) [![Code Climate](http://img.shields.io/codeclimate/github/wooorm/alex.svg)](https://codeclimate.com/github/wooorm/alex)

Whether your own or someone else’s writing, **alex** helps you find gender
favouring, polarising, binary thinking, identity insensitive, race related,
religion inconsiderate, or other **unequal** phrasing.

For example, when `We’ve confirmed his identity` is given to **alex**,
it will warn you and suggest using `their` instead of `his`<sup>†</sip>.

† - Yes, using `they` here is standard English since the 16<sup>th</sup>
century, and was used by Shakespeare.

## Why

*   [x] Catches numerous different possible offenses;
*   [x] Suggests helpful alternatives;
*   [x] Reads plain-text and markdown as input;
*   [x] Stylish;
*   [x] Actively maintained;
*   [x] Feature requests and issues are more than welcome!

## Installation

[npm](https://docs.npmjs.com/cli/install) (with [node](https://nodejs.org/download/)):

```bash
npm install alex --global
```

## Table of Contents

*   [Command Line](#command-line)

*   [Programmatic](#programmatic)

    *   [alex(value)](#alexvalue)

*   [Editors](#editors)

*   [Support](#support)

*   [Globbing](#globbing)

*   [Contributing](#contributing)

*   [License](#license)

## Command Line

![Example of how alex looks on screen](screenshot.png)

Let’s say `example.md` looks as follows:

```markdown
The boogeyman wrote all changes to the **master server**. Thus, the slaves
were read-only copies of master. But not to worry, he was cripple.
```

Then, run **alex** on `example.md`:

```sh
alex example.md
```

Yields:

```text
example.md
   1:5-1:14  warning  `boogeyman` may be insensitive, use `boogey` instead
  1:42-1:48  warning  `master` / `slaves` may be insensitive, use `primary` / `replica` instead
  2:52-2:54  warning  `he` may be insensitive, use `they`, `it` instead
  2:59-2:66  warning  `cripple` may be insensitive, use `person with a limp` instead
```

See `alex --help` for more information.

## Programmatic

### alex(value)

**Example**

```js
alex('We’ve confirmed his identity.').messages;
/*
 * [ { [1:17-1:20: `his` may be insensitive, use `their`, `theirs` instead]
 *   name: '1:17-1:20',
 *   file: '',
 *   reason: '`his` may be insensitive, use `their`, `theirs` instead',
 *   line: 1,
 *   column: 17,
 *   fatal: false } ]
 */
```

**Parameters**

*   `value` ([`VFile`](https://github.com/wooorm/vfile) or `string`) —
    Markdown or plain-text.

**Returns**

[`VFile`](https://github.com/wooorm/vfile). You’ll probably be interested
in its [`messages`](https://github.com/wooorm/vfile#vfilemessages) property, as
demonstrated in the example above, as it holds the possible violations.

## Editors

*   Atom — [atom-linter-alex](https://github.com/wooorm/atom-linter-alex).

## Support

**Alex** checks for many patterns of English language, and warns for:

*   Gendered work-titles, for example warning about `garbageman` and suggesting
    `garbage collector` instead;

*   Gendered proverbs, such as warning about `like a man` and suggesting
    `bravely` instead, or `ladylike` and suggesting `courteous`;

*   Blunt phrases, such as warning about `cripple` and suggesting
    `person with a limp` instead;

*   Intolerant phrasing, such as warning about using `master` and `slave`
    together, and suggesting `primary` and `replica` instead.

## Traversal

```sh
alex $(git ls-files | awk '/.(md|txt)$/')
```

There’s no native support for globbing yet, but Unix is awesome. The above
script will process all by git known (and not ignored) files with an `md` or
`txt` extension.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © [Titus Wormer](http://wooorm.com)
