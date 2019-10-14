<!--lint disable no-html first-heading-level no-shell-dollars-->

<h1 align="center">
  <img width="400" src="https://raw.githubusercontent.com/get-alex/alex/c30ec12/media/logo.svg?sanitize=true" alt="alex">
  <br>
  <br>
</h1>

> 📝 **alex** — Catch insensitive, inconsiderate writing.

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![First timers friendly][first-timers-badge]][first-timers]

Whether your own or someone else’s writing, **alex** helps you find gender
favouring, polarising, race related, religion inconsiderate, or other
**unequal** phrasing in text.

For example, when `We’ve confirmed his identity` is given, **alex** will warn
you and suggest using `their` instead of `his`.

Give **alex** a spin on the [Online demo »][demo].

## Why

*   [x] Helps to get better at considerate writing
*   [x] Catches many possible offences
*   [x] Suggests helpful alternatives
*   [x] Reads plain-text, HTML, and markdown as input
*   [x] Stylish

## Install

Using [npm][] (with [Node.js][node]):

```sh
$ npm install alex --global
```

Using [yarn][]:

```sh
$ yarn global add alex
```

<!--alex disable wacko stupid-->

## Table of Contents

*   [Checks](#checks)
*   [Integrations](#integrations)
*   [Ignoring files](#ignoring-files)
    *   [`.alexignore`](#alexignore)
*   [Control](#control)
*   [Configuration](#configuration)
*   [CLI](#cli)
*   [API](#api)
    *   [`alex(value, config)`](#alexvalue-config)
    *   [`alex.markdown(value, config)`](#alexmarkdownvalue-config)
    *   [`alex.html(value, config)`](#alexhtmlvalue-config)
    *   [`alex.text(value, config)`](#alextextvalue-config)
*   [Workflow](#workflow)
*   [FAQ](#faq)
    *   [This is stupid!](#this-is-stupid)
    *   [alex didn’t check “X”!](#alex-didnt-check-x)
    *   [Why is this named alex?](#why-is-this-named-alex)
*   [Contribute](#contribute)
*   [Origin story](#origin-story)
*   [Acknowledgments](#acknowledgments)
*   [License](#license)

## Checks

**alex** checks things such as:

*   Gendered work-titles, such as suggesting `garbage collector` for
    `garbageman` and `proprietor` for `landlord`
*   Gendered proverbs, such as suggesting `bravely` for `like a man`, or
    `courteous` for `ladylike`.
*   Ablist language, such as suggesting `person with learning disabilities` for
    `learning disabled`
*   Condescending language, such as warning for `obviously`, `everyone knows`,
    etc
*   Intolerant phrasing, such as suggesting `primary` and `replica` instead of
    `master` and `slave`
*   Profanities, such as `butt` 🍑

…and much more!

See [`retext-equality`][equality] and [`retext-profanities`][profanities] for
all rules.

**alex** ignores words meant literally, so `“he”`, `He — ...`, and [the
like][literals] are not warned about.

## Integrations

*   Atom — [`get-alex/atom-linter-alex`](https://github.com/get-alex/atom-linter-alex)
*   Sublime — [`sindresorhus/SublimeLinter-contrib-alex`](https://github.com/sindresorhus/SublimeLinter-contrib-alex)
*   Visual Studio Code — [`shinnn/vscode-alex`](https://github.com/shinnn/vscode-alex)
*   Gulp — [`dustinspecker/gulp-alex`](https://github.com/dustinspecker/gulp-alex)
*   Slack — [`keoghpe/alex-slack`](https://github.com/keoghpe/alex-slack)
*   Ember — [`yohanmishkin/ember-cli-alex`](https://github.com/yohanmishkin/ember-cli-alex)
*   Probot — [`swinton/linter-alex`](https://github.com/swinton/linter-alex)
*   Vim — [`w0rp/ale`](https://github.com/w0rp/ale)
*   Browser extension — [`skn0tt/alex-browser-extension`](https://github.com/skn0tt/alex-browser-extension)
*   Contentful - [`stefanjudis/alex-js-contentful-ui-extension`](https://github.com/stefanjudis/alex-js-contentful-ui-extension)

## Ignoring files

The CLI searches for files with a markdown or text extension when given
directories (so `$ alex .` will find `readme.md` and `path/to/file.txt`).
To prevent files from being found, create an [`.alexignore`][alexignore] file.

### `.alexignore`

The CLI will sometimes [search for files][ignoring-files].
To prevent files from being found, add a file named `.alexignore` in one of the
directories above the current working directory (the place you run `alex` from).
The format of these files is similar to [`.eslintignore`][eslintignore] (which
is in turn similar to `.gitignore` files).

For example, when working in `~/path/to/place`, the ignore file can be in
`place`, but also in `~`.

The ignore file for [this project itself][.alexignore] looks like this:

```txt
# `node_modules` is ignored by default.
example.md
```

## Control

Sometimes **alex** makes mistakes:

```markdown
A message for this sentence will pop up.
```

Yields:

```txt
readme.md
  1:15-1:18  warning  `pop` may be insensitive, use `parent` instead  dad-mom  retext-equality

⚠ 1 warning
```

HTML comments in markdown can be used to ignore them:

```markdown
<!--alex ignore dad-mom-->

A message for this sentence will **not** pop up.
```

Yields:

```txt
readme.md: no issues found
```

`ignore` turns off messages for the thing after the comment (in this case, the
paragraph).
It’s also possible to turn off messages after a comment by using `disable`, and,
turn those messages back on using `enable`:

```markdown
<!--alex disable dad-mom-->

A message for this sentence will **not** pop up.

A message for this sentence will also **not** pop up.

Yet another sentence where a message will **not** pop up.

<!--alex enable dad-mom-->

A message for this sentence will pop up.
```

Yields:

```txt
readme.md
  9:15-9:18  warning  `pop` may be insensitive, use `parent` instead  dad-mom  retext-equality

⚠ 1 warning
```

Multiple messages can be controlled in one go:

```md
<!--alex disable he-her his-hers dad-mom-->
```

…and all messages can be controlled by omitting all rule identifiers:

```md
<!--alex ignore-->
```

## Configuration

You can control **alex** through `.alexrc` configuration files:

```json
{
  "allow": ["boogeyman-boogeywoman"]
}
```

…you can use YAML if the file is named `.alexrc.yml` or `.alexrc.yaml`:

```yml
allow:
  - dad-mom
```

…you can also use JavaScript if the file is named `.alexrc.js`:

```js
exports.profanitySureness = Math.floor(Math.random() * 3)
```

…and finally it is possible to use an `alex` field in `package.json`:

```txt
{
  …
  "alex": {
    "noBinary": true
  },
  …
}
```

The `allow` field should be an array of rules (the default is `[]`).

The `noBinary` field should be a boolean (the default is `false`).
When turned on (`true`), pairs such as `he and she`, `garbageman or
garbagewoman`, are seen as errors.
When turned off (`false`, the default), such pairs are seen as OK.

The `profanitySureness` field is a number (the default is `0`).
We use [cuss][], which has a dictionary of words that have a rating between 0
and 2 of how likely it is that a word or phrase is a profanity (not how “bad” it
is):

| Rating | Use as a profanity | Use in clean text | Example |
| ------ | ------------------ | ----------------- | ------- |
| 2      | likely             | unlikely          | asshat  |
| 1      | maybe              | maybe             | addict  |
| 0      | unlikely           | likely            | beaver  |

The `profanitySureness` field is the minimum rating (including) that you want to
check for.
If you set it to `1` (maybe) then it will warn for level `1` *and* `2` (likely)
profanities, but not for level `0` (unlikely).

## CLI

<!--alex enable wacko stupid-->

![][screenshot]

Let’s say `example.md` looks as follows:

```markdown
The boogeyman wrote all changes to the **master server**. Thus, the slaves
were read-only copies of master. But not to worry, he was a cripple.
```

Now, run **alex** on `example.md`:

```sh
$ alex example.md
```

Yields:

```txt
example.md
   1:5-1:14  warning  `boogeyman` may be insensitive, use `boogey` instead                       boogeyman-boogeywoman  retext-equality
  1:42-1:48  warning  `master` / `slaves` may be insensitive, use `primary` / `replica` instead  master-slave           retext-equality
  1:70-1:76  warning  Don’t use `slaves`, it’s profane                                           slaves                 retext-profanities
  2:53-2:55  warning  `he` may be insensitive, use `they`, `it` instead                          he-she                 retext-equality
  2:62-2:69  warning  `cripple` may be insensitive, use `person with a limp` instead             gimp                   retext-equality

⚠ 5 warnings
```

See `$ alex --help` for more information.

> When no input files are given to **alex**, it searches for files in the
> current directory, `doc`, and `docs`.
> If `--html` is given, it searches for `htm` and `html` extensions.
> Otherwise, it searches for `txt`, `text`, `md`, `mkd`, `mkdn`, `mkdown`,
> `ron`, and `markdown` extensions.

## API

[npm][]:

```sh
$ npm install alex --save
```

**alex** is also available as an AMD, CommonJS, and globals module,
[uncompressed and compressed][releases].

### `alex(value, config)`

### `alex.markdown(value, config)`

Check markdown (ignoring syntax).

###### Parameters

*   `value` ([`VFile`][vfile] or `string`) — Markdown document
*   `config` (`Object`, optional) — See the [Configuration][] section

###### Returns

[`VFile`][vfile].
You are probably interested in its [`messages`][vfile-message] property, as
shown in the example above, because it holds the possible violations.

###### Example

```js
alex('We’ve confirmed his identity.').messages
```

Yields:

```js
[
  [1:17-1:20: `his` may be insensitive, when referring to a person, use `their`, `theirs`, `them` instead] {
    message: '`his` may be insensitive, when referring to a ' +
      'person, use `their`, `theirs`, `them` instead',
    name: '1:17-1:20',
    reason: '`his` may be insensitive, when referring to a ' +
      'person, use `their`, `theirs`, `them` instead',
    line: 1,
    column: 17,
    location: { start: [Object], end: [Object] },
    source: 'retext-equality',
    ruleId: 'her-him',
    fatal: false,
    actual: 'his',
    expected: [ 'their', 'theirs', 'them' ]
  }
]
```

### `alex.html(value, config)`

Check HTML (ignoring syntax).
Similar to [`alex()`][alex-api] and [`alex.text()`][alex-text]).

###### Parameters

*   `value` ([`VFile`][vfile] or `string`) — HTML document
*   `config` (`Object`, optional) — See the [Configuration][] section

###### Returns

[`VFile`][vfile].

###### Example

```js
alex.html('<p class="black">He walked to class.</p>').messages
```

Yields:

```js
[
  [1:18-1:20: `He` may be insensitive, use `They`, `It` instead] {
    message: '`He` may be insensitive, use `They`, `It` instead',
    name: '1:18-1:20',
    reason: '`He` may be insensitive, use `They`, `It` instead',
    line: 1,
    column: 18,
    location: { start: [Object], end: [Object] },
    source: 'retext-equality',
    ruleId: 'he-she',
    fatal: false,
    actual: 'He',
    expected: [ 'They', 'It' ]
  }
]
```

### `alex.text(value, config)`

Check plain text (so syntax is checked).
Similar to [`alex()`][alex-api] and [`alex.html()`][alex-html]).

###### Parameters

*   `value` ([`VFile`][vfile] or `string`) — Text document
*   `config` (`Object`, optional) — See the [Configuration][] section

###### Returns

[`VFile`][vfile].

###### Example

```js
alex('The `boogeyman`.').messages // => []

alex.text('The `boogeyman`.').messages
```

Yields:

```js
[ { [1:6-1:15: `boogeyman` may be insensitive, use `boogey` instead]
    message: '`boogeyman` may be insensitive, use `boogey` instead',
    name: '1:6-1:15',
    reason: '`boogeyman` may be insensitive, use `boogey` instead',
    line: 1,
    column: 6,
    location: Position { start: [Object], end: [Object] },
    source: 'retext-equality',
    ruleId: 'boogeyman-boogeywoman',
    fatal: false } ]
```

## Workflow

The recommended workflow is to add **alex** to `package.json` and to run it with
your tests in Travis.

You can opt to ignore warnings through [alexrc][configuration] files and
[control comments][control].

A `package.json` file with [npm scripts][npm-scripts], and additionally using
[AVA][] for unit tests, could look like so:

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

If you’re using Travis for continuous integration, set up something like the
following in your `.travis.yml`:

```diff
 script:
 - npm test
+- alex --diff
```

Make sure to still install alex though!

If the `--diff` flag is used, and Travis is detected, lines that are not changes
in this push are ignored.
Using this workflow, you can merge PRs if it has warnings, and then if someone
edits an entirely different file, they won’t be bothered about existing
warnings, only about the things they added!

## FAQ

<!--lint disable no-heading-punctuation-->

<!--alex ignore wacko stupid-->

### This is stupid!

Not a question.
And yeah, alex isn’t very smart.
People are much better at this.
But people make mistakes, and alex is there to help.

### alex didn’t check “X”!

See [`contributing.md`][contributing] on how to get “X” checked by alex.

### Why is this named alex?

It’s a nice unisex name, it was free on npm, I like it!  :smile:

<!--lint enable no-heading-punctuation-->

## Contribute

See [`contributing.md`][contributing] in [`get-alex/.github`][health] for ways
to get started.
See [`support.md`][support] for ways to get help.

This project has a [Code of conduct][coc].
By interacting with this repository, organisation, or community you agree to
abide by its terms.

## Origin story

Thanks to [**@iheanyi**][iheany] for [raising the problem][tweet] and
[**@sindresorhus**][sindre] for inspiring me ([**@wooorm**][wooorm]) to do
something about it.

When alex launched, it got some traction on [twitter][] and [producthunt][].
Then there was a [lot][tnw] [of][dailydot] [press][vice] [coverage][bustle].

## Acknowledgments

Preliminary work for alex was done [in 2015][preliminary].
The project was authored by [**@wooorm**][wooorm].

Lot’s of [people helped since][contributors]!

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions. -->

[build]: https://travis-ci.org/get-alex/alex

[build-badge]: https://img.shields.io/travis/get-alex/alex.svg

[coverage]: https://codecov.io/github/get-alex/alex

[coverage-badge]: https://img.shields.io/codecov/c/github/get-alex/alex.svg

[first-timers]: https://www.firsttimersonly.com/

[first-timers-badge]: https://img.shields.io/badge/first--timers--only-friendly-blue.svg

[node]: https://nodejs.org/en/download/

[npm]: https://docs.npmjs.com/cli/install

[yarn]: https://yarnpkg.com/

[demo]: http://alexjs.com/#demo

[screenshot]: screenshot.png

[releases]: https://github.com/get-alex/alex/releases

[vfile]: https://github.com/vfile/vfile

[profanities]: https://github.com/retextjs/retext-profanities/blob/master/rules.md

[equality]: https://github.com/retextjs/retext-equality/blob/master/rules.md

[vfile-message]: https://github.com/vfile/vfile#vfilemessages

[literals]: https://github.com/syntax-tree/nlcst-is-literal#isliteralparent-index

[eslintignore]: http://eslint.org/docs/user-guide/configuring.html#ignoring-files-and-directories

[cuss]: https://github.com/words/cuss

[npm-scripts]: https://docs.npmjs.com/misc/scripts

[ava]: http://ava.li

[author]: http://wooorm.com

[health]: https://github.com/get-alex/.github

[contributing]: https://github.com/get-alex/.github/blob/master/contributing.md

[support]: https://github.com/get-alex/.github/blob/master/support.md

[coc]: https://github.com/get-alex/.github/blob/master/code-of-conduct.md

[tweet]: https://twitter.com/kwuchu/status/618799087006130176

[twitter]: https://twitter.com/wooorm/status/639123753490907136

[producthunt]: https://www.producthunt.com/posts/alex

[tnw]: http://thenextweb.com/apps/2015/09/11/alex-stops-you-from-publishing-inconsiderate-content/

[vice]: https://www.vice.com/en_us/article/nzeawx/meet-alex-the-javascript-tool-to-make-your-code-less-offensive

[bustle]: https://www.bustle.com/articles/108684-alex-javascript-tool-corrects-harmful-language-in-your-writing-because-there-are-some-mistakes-spell-check

[dailydot]: https://www.dailydot.com/debug/alex-coding-tool-offensive/

[iheany]: https://github.com/iheanyi

[sindre]: https://github.com/sindresorhus

[wooorm]: https://github.com/wooorm

[preliminary]: https://github.com/get-alex/alex/commit/3621b0a

[contributors]: https://github.com/get-alex/alex/graphs/contributors

[.alexignore]: .alexignore

[license]: license

[alex-api]: #alexvalue-config

[alex-html]: #alexhtmlvalue-config

[alex-text]: #alextextvalue-config

[control]: #control

[configuration]: #configuration

[ignoring-files]: #ignoring-files

[alexignore]: #alexignore
