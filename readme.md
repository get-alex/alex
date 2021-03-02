<!--lint disable no-html first-heading-level no-shell-dollars-->

<h1 align="center">
  <img width="300" src="https://raw.githubusercontent.com/get-alex/alex/a192b46/media/logo-alex-purple.svg?sanitize=true" alt="alex">
  <br>
  <br>
</h1>

> 📝 **alex** — Catch insensitive, inconsiderate writing.

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![First timers friendly][first-timers-badge]][first-timers]

Whether your own or someone else’s writing, **alex** helps you find gender
favoring, polarizing, race related, religion inconsiderate, or other **unequal**
phrasing in text.

For example, when `We’ve confirmed his identity` is given, **alex** will warn
you and suggest using `their` instead of `his`.

Give **alex** a spin on the [Online demo »][demo].

## Why

*   [x] Helps to get better at considerate writing
*   [x] Catches many possible offences
*   [x] Suggests helpful alternatives
*   [x] Reads plain text, HTML, MDX, or markdown as input
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

Or you can follow this step-by-step tutorial:
[Setting up alex in your project][setup-tutorial]

<!--alex disable wacko stupid-->

## Contents

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
    *   [`alex.mdx(value, config)`](#alexmdxvalue-config)
    *   [`alex.html(value, config)`](#alexhtmlvalue-config)
    *   [`alex.text(value, config)`](#alextextvalue-config)
*   [Workflow](#workflow)
*   [FAQ](#faq)
    *   [This is stupid!](#this-is-stupid)
    *   [alex didn’t check “X”!](#alex-didnt-check-x)
    *   [Why is this named alex?](#why-is-this-named-alex)
*   [Further reading](#further-reading)
*   [Contribute](#contribute)
*   [Origin story](#origin-story)
*   [Acknowledgments](#acknowledgments)
*   [License](#license)

## Checks

**alex** checks things such as:

*   Gendered work-titles (if you write `garbageman` alex suggests `garbage
    collector`; if you write `landlord` alex suggests `proprietor`)
*   Gendered proverbs (if you write `like a man` alex suggests `bravely`; if you
    write `ladylike` alex suggests `courteous`)
*   Ableist language (if you write `learning disabled` alex suggests `person
    with learning disabilities`)
*   Condescending language (if you write `obviously` or `everyone knows` alex
    warns about it)
*   Intolerant phrasing (if you write `master` and `slave` alex suggests
    `primary` and `replica`)
*   Profanities (if you write `butt` 🍑 alex warns about it)

…and much more!

Note: alex assumes good intent: that you don’t mean to offend!

See [`retext-equality`][equality] and [`retext-profanities`][profanities] for
all rules.

**alex** ignores words meant literally, so `“he”`, `He — ...`, and [the
like][literals] are not warned about.

## Integrations

*   Atom — [`get-alex/atom-linter-alex`](https://github.com/get-alex/atom-linter-alex)
*   Sublime — [`sindresorhus/SublimeLinter-contrib-alex`](https://github.com/sindresorhus/SublimeLinter-contrib-alex)
*   Gulp — [`dustinspecker/gulp-alex`](https://github.com/dustinspecker/gulp-alex)
*   Slack — [`keoghpe/alex-slack`](https://github.com/keoghpe/alex-slack)
*   Ember — [`yohanmishkin/ember-cli-alex`](https://github.com/yohanmishkin/ember-cli-alex)
*   Probot — [`swinton/linter-alex`](https://github.com/swinton/linter-alex)
*   GitHub Actions — [`brown-ccv/alex-recommends`](https://github.com/marketplace/actions/alex-recommends)
*   GitHub Actions (reviewdog) — [`reviewdog/action-alex`](https://github.com/marketplace/actions/run-alex-with-reviewdog)
*   Vim — [`w0rp/ale`](https://github.com/w0rp/ale)
*   Browser extension — [`skn0tt/alex-browser-extension`](https://github.com/skn0tt/alex-browser-extension)
*   Contentful - [`stefanjudis/alex-js-contentful-ui-extension`](https://github.com/stefanjudis/alex-js-contentful-ui-extension)
*   Figma - [`nickradford/figma-plugin-alex`](https://github.com/nickradford/figma-plugin-alex)
*   VSCode - [`tlahmann/vscode-alex`](https://github.com/tlahmann/vscode-alex)

## Ignoring files

The CLI searches for files with a markdown or text extension when given
directories (so `$ alex .` will find `readme.md` and `path/to/file.txt`).
To prevent files from being found, create an [`.alexignore`][alexignore] file.

### `.alexignore`

The CLI will sometimes [search for files][ignoring-files].
To prevent files from being found, add a file named `.alexignore` in one of the
directories above the current working directory (the place you run `alex` from).
The format of these files is similar to [`.eslintignore`][eslintignore] (which
in turn is similar to `.gitignore` files).

For example, when working in `~/path/to/place`, the ignore file can be in
`to`, `place`, or `~`.

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

HTML comments in Markdown can be used to ignore them:

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
// But making it random like this is a bad idea!
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

The `allow` field should be an array of rules or `undefined` (the default is
`undefined`).  When provided, the rules specified are skipped and not reported.

The `deny` field should be an array of rules or `undefined` (the default is
`undefined`).  When provided, *only* the rules specified are reported.

You cannot use both `allow` and `deny` at the same time.

The `noBinary` field should be a boolean (the default is `false`).
When turned on (`true`), pairs such as `he and she` and `garbageman or
garbagewoman` are seen as errors.
When turned off (`false`, the default), such pairs are okay.

The `profanitySureness` field is a number (the default is `0`).
We use [`cuss`][cuss], which has a dictionary of words that have a rating
between 0 and 2 of how likely it is that a word or phrase is a profanity (not
how “bad” it is):

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
   1:5-1:14  warning  `boogeyman` may be insensitive, use `boogeymonster` instead                boogeyman-boogeywoman  retext-equality
  1:42-1:48  warning  `master` / `slaves` may be insensitive, use `primary` / `replica` instead  master-slave           retext-equality
  1:69-1:75  warning  Don’t use `slaves`, it’s profane                                           slaves                 retext-profanities
  2:52-2:54  warning  `he` may be insensitive, use `they`, `it` instead                          he-she                 retext-equality
  2:61-2:68  warning  `cripple` may be insensitive, use `person with a limp` instead             gimp                   retext-equality

⚠ 5 warnings
```

See `$ alex --help` for more information.

> When no input files are given to **alex**, it searches for files in the
> current directory, `doc`, and `docs`.
> If `--mdx` is given, it searches for `mdx` extensions.
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

Check Markdown (ignoring syntax).

###### Parameters

*   `value` ([`VFile`][vfile] or `string`) — Markdown document
*   `config` (`Object`, optional) — See the [Configuration][] section

###### Returns

[`VFile`][vfile].
You are probably interested in its [`messages`][vfile-message] property, as
shown in the example below, because it holds the possible violations.

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

### `alex.mdx(value, config)`

Check [MDX][] (ignoring syntax).

> Note: the syntax for [MDX@2][mdx-next], while currently in beta, is used in
> alex.

###### Parameters

*   `value` ([`VFile`][vfile] or `string`) — MDX document
*   `config` (`Object`, optional) — See the [Configuration][] section

###### Returns

[`VFile`][vfile].

###### Example

```js
alex.mdx('<Component>He walked to class.</Component>').messages
```

Yields:

```js
[
  [1:12-1:14: `He` may be insensitive, use `They`, `It` instead] {
    reason: '`He` may be insensitive, use `They`, `It` instead',
    line: 1,
    column: 12,
    location: { start: [Object], end: [Object] },
    source: 'retext-equality',
    ruleId: 'he-she',
    fatal: false,
    actual: 'He',
    expected: [ 'They', 'It' ]
  }
]
```

### `alex.html(value, config)`

Check HTML (ignoring syntax).

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

Check plain text (as in, syntax is checked).

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
[
  [1:6-1:15: `boogeyman` may be insensitive, use `boogeymonster` instead] {
    message: '`boogeyman` may be insensitive, use `boogeymonster` instead',
    name: '1:6-1:15',
    reason: '`boogeyman` may be insensitive, use `boogeymonster` instead',
    line: 1,
    column: 6,
    location: Position { start: [Object], end: [Object] },
    source: 'retext-equality',
    ruleId: 'boogeyman-boogeywoman',
    fatal: false,
    actual: 'boogeyman',
    expected: [ 'boogeymonster' ]
  }
]
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

## Further reading

No automated tool can replace studying inclusive communication and listening to
the lived experiences of others.
An error from `alex` can be an invitation to learn more.
These resources are a launch point for deepening your own understanding and
editorial skills beyond what `alex` can offer:

*   The [18F Content Guide](https://content-guide.18f.gov/our-style/inclusive-language/)
    has a helpful list of links to other inclusive language guides used in
    journalism and academic writing.
*   The [Conscious Style Guide](https://consciousstyleguide.com/articles/) has
    articles on many nuanced topics of language.  For example, the terms race
    and ethnicity mean different things, and choosing the right word is up to
    you.
    Likewise, a sentence that overgeneralizes about a group of people
    (e.g. “Developers love to code all day”) may not be noticed by `alex`, but
    it is not inclusive.  A good human editor can step up to the challenge and
    find a better way to phrase things.
*   Sometimes, the only way to know what is inclusive is to ask.
    In [Disability is a nuanced thing](https://incl.ca/disability-language-is-a-nuanced-thing/),
    Nicolas Steenhout writes about how person-first language, such as
    “a person with a disability,” is not always the right choice.
*   Language is always evolving.  A term that is neutral one year ago can be
    problematic today.  Projects like the
    [Self-Defined Dictionary](https://github.com/selfdefined/web-app) aim to
    collect the words that we use to define ourselves and others, and connect
    them with the history and some helpful advice.
*   Unconsious bias is present in daily decisions and conversations and can show
    up in writing.
    [Textio](https://textio.com/blog/4-overlooked-types-of-bias-in-business-writing/27521593662)

    offers some examples of how descriptive adjective choice and tone can push
    some people away, and how regional language differences can cause confusion.
*   Using complex sentences and uncommon vocabulary can lead to less inclusive
    content.  This is described as literacy exclusion in
    [this article by Harver](https://harver.com/blog/inclusive-job-descriptions/).
    This is critical to be aware of if your content has a global audience,
    where a reader’s strongest language may not be the language you are writing
    in.

## Contribute

See [`contributing.md`][contributing] in [`get-alex/.github`][health] for ways
to get started.
See [`support.md`][support] for ways to get help.

This project has a [Code of conduct][coc].
By interacting with this repository, organization, or community you agree to
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

Lots of [people helped since][contributors]!

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions. -->

[build]: https://github.com/get-alex/alex/actions

[build-badge]: https://github.com/get-alex/alex/workflows/main/badge.svg

[coverage]: https://codecov.io/github/get-alex/alex

[coverage-badge]: https://img.shields.io/codecov/c/github/get-alex/alex.svg

[first-timers]: https://www.firsttimersonly.com/

[first-timers-badge]: https://img.shields.io/badge/first--timers--only-friendly-blue.svg

[node]: https://nodejs.org/en/download/

[npm]: https://docs.npmjs.com/cli/install

[yarn]: https://yarnpkg.com/

[setup-tutorial]: https://dev.to/meeshkan/setting-up-the-alex-js-language-linter-in-your-project-3bpl

[demo]: http://alexjs.com/#demo

[screenshot]: screenshot.png

[releases]: https://github.com/get-alex/alex/releases

[vfile]: https://github.com/vfile/vfile

[profanities]: https://github.com/retextjs/retext-profanities/blob/main/rules.md

[equality]: https://github.com/retextjs/retext-equality/blob/main/rules.md

[vfile-message]: https://github.com/vfile/vfile#vfilemessages

[literals]: https://github.com/syntax-tree/nlcst-is-literal#isliteralparent-index

[eslintignore]: http://eslint.org/docs/user-guide/configuring.html#ignoring-files-and-directories

[cuss]: https://github.com/words/cuss

[npm-scripts]: https://docs.npmjs.com/misc/scripts

[ava]: http://ava.li

[author]: http://wooorm.com

[health]: https://github.com/get-alex/.github

[contributing]: https://github.com/get-alex/.github/blob/main/contributing.md

[support]: https://github.com/get-alex/.github/blob/main/support.md

[coc]: https://github.com/get-alex/.github/blob/main/code-of-conduct.md

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

[control]: #control

[configuration]: #configuration

[ignoring-files]: #ignoring-files

[alexignore]: #alexignore

[mdx]: https://mdxjs.com

[mdx-next]: https://github.com/mdx-js/mdx/issues/1041
