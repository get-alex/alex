# Contributing

> This project has a [Code of Conduct][coc].  By interacting with this
> repository or community you agree to abide by its terms.

Hi!  👋 Exciting that you’re interested in contributing!  Before doing so, take
a moment to read the following guidelines.  And thanks for contributing to
**alex**!  👏👌✨

Before anything else: people involved with this project often do so for fun,
as volunteers, next to their day job.  Please be considerate in requests for
features and changes, and be patient regarding response times.  Maintainers
are not able to respond to individual support requests, but if you feel
that something in the documentation is missing or incorrect, please
let us know!

## Table of Contents

*   [Ecosystem](#ecosystem)
*   [Trying out your local changes](#trying-out-your-local-changes)
*   [Running tests](#running-tests)
*   [Contributions](#contributions)
    *   [Improve documentation](#improve-documentation)
    *   [Improve issues](#improve-issues)
    *   [Give feedback on issues](#give-feedback-on-issues)
    *   [Write code](#write-code)
    *   [Website contributions](#website-contributions)
    *   [Adding profanities and other words](#adding-profanities-and-other-words)
*   [Submitting an issue](#submitting-an-issue)
*   [Submitting a pull request](#submitting-a-pull-request)
*   [Resources](#resources)

## Ecosystem

This project, `alex`, is a small wrapper around the [unified][] ecosystem.
It mainly uses [`retext`][retext] to process natural language, with the
[`retext-equality`][equality] and [`retext-profanities`][profanities] plugins.
For markdown, [`remark`][remark] is used.

Try and pick the right place to contribute to so we can help you faster.
`alex` handles the user’s command line experience, while the `retext`
plugins determine the rules and recommendations.

## Trying out your local changes

To see how your local changes affect `alex`, you can use
[npm link](https://docs.npmjs.com/cli/link)

```sh
git clone <your fork url>
cd alex
npm install
npm link
alex some-file.md
```

## Running tests

```sh
npm test
```

## Contributions

There’s several ways to contribute, not just by writing code.

### Improve documentation

As a user of this project you’re perfect for helping us improve our docs.
Typo corrections, error fixes, better explanations, new examples, etcetera.
Anything!

### Improve issues

Some issues lack information, aren’t reproducible, or are just incorrect.
Help make them easier to resolve.

### Give feedback on issues

We’re always looking for more opinions on discussions in the issue tracker.

### Write code

Code contributions are very welcome.  It’s often good to first create an issue
to report a bug or suggest a new feature before creating a pull request to
prevent you from doing unnecessary work.

### Website contributions

There are ways in which our [website][website] can be improved as well, and
we are open to contributions.
Switch to the [`website`][website-branch] branch (with `git checkout website`)
and start contributing!
Changes made to the [`src`][src-folder] folder are automatically
built to the [`dest`][dest-folder] folder.

### Adding profanities and other words

If you have profanities, insensitive words, and/or any other additions to add
to our repository, you’ll need to make a PR to [`profanities`][profanities], 
and then [`cuss`][cuss] after the former is released.  The words will
automatically be added into [`retext-profanities`][profanities] and Alex as
well.

## Submitting an issue

*   The issue tracker is for issues
*   Try to find the best issue tracker ([`remark`][remark], [`retext`][retext],
    [`retext-equality`][equality], [`retext-profanities`][profanities], or here)
    for your issue
*   Search the issue tracker (including closed issues) before opening a new
    issue
*   Ensure you’re using the latest version of projects
*   Use a clear and descriptive title
*   Include as much information as possible: steps to reproduce the issue,
    error message, version, operating system, etcetera
*   The more time you put into an issue, the more we will
*   The best issue report is a [failing test][unit-test] proving it

## Submitting a pull request

*   Non-trivial changes are often best discussed in an issue first, to prevent
    you from doing unnecessary work
*   For ambitious tasks, you should try to get your work in front of the
    community for feedback as soon as possible
*   New features should be accompanied with tests and documentation
*   Don’t include unrelated changes
*   Lint and test before submitting code by running `$ npm test`
*   Write a convincing description of why we should land your pull request:
    it’s your job to convince us

## Resources

*   [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
*   [Your first open source contribution: a step-by-step technical guide](https://medium.com/@jenweber/your-first-open-source-contribution-a-step-by-step-technical-guide-d3aca55cc5a6)
*   [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
*   [GitHub Help](https://help.github.com)

[coc]: https://github.com/get-alex/alex/blob/master/code-of-conduct.md

[cuss]: https://github.com/words/cuss

[unified]: https://github.com/unifiedjs/unified

[remark]: https://github.com/remarkjs/remark

[retext]: https://github.com/retextjs/retext

[equality]: https://github.com/retextjs/retext-equality

[profanities]: https://github.com/retextjs/retext-profanities

[unit-test]: https://twitter.com/sindresorhus/status/579306280495357953

[website]: https://alexjs.com

[website-branch]: https://github.com/get-alex/alex/tree/website

[src-folder]: https://github.com/get-alex/alex/tree/website/src

[dest-folder]: https://github.com/get-alex/alex/tree/website/dest
