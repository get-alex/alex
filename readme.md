<!--lint disable no-html first-heading-level maximum-line-length-->

<h1 align="center">
  <img width="400" src="https://rawgit.com/wooorm/alex/master/media/logo.svg" alt="alex">
  <br>
  <br>
</h1>

> 📝 **alex** — Catch insensitive, inconsiderate writing.

[![Build Status](https://img.shields.io/travis/wooorm/alex.svg)](https://travis-ci.org/wooorm/alex) [![Coverage Status](https://img.shields.io/codecov/c/github/wooorm/alex.svg)](https://codecov.io/github/wooorm/alex)

Whether your own or someone else’s writing, **alex** helps you find gender
favouring, polarising, race related, religion inconsiderate, or other
**unequal** phrasing.

For example, when `We’ve confirmed his identity` is given to **alex**,
it will warn you and suggest using `their` instead of `his`.

> Suggestions, feature requests, and issues are more than welcome!

Give **alex** a spin on the [Online demo »](http://alexjs.com/#demo).

## Why

*   [x] To get better at considerate writing;
*   [x] Catches many possible offenses;
*   [x] Suggests helpful alternatives;
*   [x] Reads plain-text and markdown as input;
*   [x] Stylish.

## Install

[npm](https://docs.npmjs.com/cli/install) (with [Node.js](https://nodejs.org/en/download/)):

```sh
$ npm install alex --global
```

## Table of Contents

*   [Command Line](#command-line)

*   [API](#api)

    *   [alex(value)](#alexvalue)
    *   [alex.markdown(value)](#alexmarkdownvalue)
    *   [alex.text(value)](#alextextvalue)

*   [Integrations](#integrations)

*   [Support](#support)

*   [File finding](#file-finding)

*   [.alexignore](#alexignore)

*   [Workflow](#workflow)

*   [FAQ](#faq)

    *   [Why is this named alex?](#why-is-this-named-alex)
    *   [Alex didn’t check ‘X’!](#alex-didnt-check-x)

*   [Contributing](#contributing)

*   [License](#license)

## Command Line

![Example of how alex looks on screen](screenshot.png)

Let’s say `example.md` looks as follows:

```md
The boogeyman wrote all changes to the **master server**. Thus, the slaves
were read-only copies of master. But not to worry, he was a cripple.
```

Then, run **alex** on `example.md`:

```sh
$ alex example.md
```

Yields:

```txt
example.md
   1:5-1:14  warning  `boogeyman` may be insensitive, use `boogey` instead
  1:42-1:48  warning  `master` / `slaves` may be insensitive, use `primary` / `replica` instead
  2:52-2:54  warning  `he` may be insensitive, use `they`, `it` instead
  2:59-2:66  warning  `cripple` may be insensitive, use `person with a limp` instead
```

See `$ alex --help` for more information.

> When no input files are given to **alex**, it searches for markdown and
> text files in the current directory, `doc`, and `docs`.

## API

[npm](https://docs.npmjs.com/cli/install):

```sh
$ npm install alex --save
```

**alex** is also available for [bower](http://bower.io/#install-packages) and
[duo](http://duojs.org/#getting-started), and as an AMD, CommonJS, and globals
module, [uncompressed](alex.js) and [compressed](alex.min.js).

### alex(value)

### alex.markdown(value)

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

### alex.text(value)

Works just like [`alex()`](#alexvalue), but does not parse as markdown
(thus things like code are not ignored)

**Example**

```js
alex('The `boogeyman`.').messages; // []

alex.text('The `boogeyman`.').messages;
/*
 * [ { [1:6-1:15: `boogeyman` may be insensitive, use `boogey` instead]
 *   name: '1:6-1:15',
 *   file: '',
 *   reason: '`boogeyman` may be insensitive, use `boogey` instead',
 *   line: 1,
 *   column: 6,
 *   fatal: false } ]
 */
```

## Integrations

*   Atom — [wooorm/atom-linter-alex](https://github.com/wooorm/atom-linter-alex)
*   Sublime — [sindresorhus/SublimeLinter-contrib-alex](https://github.com/sindresorhus/SublimeLinter-contrib-alex)
*   Gulp — [dustinspecker/gulp-alex](https://github.com/dustinspecker/gulp-alex)
*   Slack — [keoghpe/alex-slack](https://github.com/keoghpe/alex-slack)

## Support

**alex** checks for many patterns of English language, and warns for:

*   Gendered work-titles, for example warning about `garbageman` and suggesting
    `garbage collector` instead;

*   Gendered proverbs, such as warning about `like a man` and suggesting
    `bravely` instead, or `ladylike` and suggesting `courteous`;

*   Blunt phrases, such as warning about `cripple` and suggesting
    `person with a limp` instead;

*   Intolerant phrasing, such as warning about using `master` and `slave`
    together, and suggesting `primary` and `replica` instead.

**alex** ignores words meant literally, so `“he”`, `He — ...`, and [the like](https://github.com/wooorm/nlcst-is-literal#isliteralparent-index)
are not warned about

## File finding

**alex** CLI searches for files with a markdown or text extension when given
directories (e.g., `$ alex .` will find `readme.md` and `foo/bar/baz.txt`).
To prevent files from being found by **alex**, add an
[`.alexignore`](#alexignore) file.

## `.alexignore`

The **alex** CLI will sometimes [search for files](#file-finding). To prevent
files from being found, add a file named `.alexignore` in one of the
directories above the current working directory. The format of these files is
similar to [`.eslintignore`](http://eslint.org/docs/user-guide/configuring.html#ignoring-files-and-directories) (which is in turn similar to `.gitignore` files).

For example, when working in `~/alpha/bravo/charlie`, the ignore file can be
in `charlie`, but also in `~`.

The ignore file for [this project itself](https://github.com/wooorm/alex/blob/master/.alexignore)
looks as follows:

```txt
# Both `node_modules` and `bower_components` are
# ignored by default:
# node_modules/
# bower_components/

components/
example.md
```

## Workflow

The recommended workflow is to add **alex** locally and to run it with your
tests.

A `package.json` file with [npm scripts](https://docs.npmjs.com/misc/scripts),
and additionally using [AVA](http://ava.li) for unit tests, could look
as follows:

```json
{
  "scripts": {
    "test-api": "ava",
    "test-doc": "alex",
    "test": "npm run test-api && npm run test-doc"
  },
  "devDependencies": {
    "alex": "^1.0.0",
    "ava": "^0.1.0"
  }
}
```

## FAQ

<!--lint disable no-heading-punctuation-->

### Why is this named alex?

It’s a nice androgynous/unisex name, it was free on npm, I like it! :smile:

### Alex didn’t check ‘X’!

See
[CONTRIBUTING.md](CONTRIBUTING.md) on how to get ‘X’ checked by alex.

<!--lint enable no-heading-punctuation-->

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © [Titus Wormer](http://wooorm.com)
