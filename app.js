'use strict'

var PassThrough = require('stream').PassThrough
var engine = require('unified-engine')
var unified = require('unified')
var markdown = require('remark-parse')
var htmlParser = require('rehype-parse')
var frontmatter = require('remark-frontmatter')
var english = require('retext-english')
var remark2retext = require('remark-retext')
var rehype2retext = require('rehype-retext')
var report = require('vfile-reporter')
var equality = require('retext-equality')
var profanities = require('retext-profanities')
var filter = require('./filter')

var textExtensions = [
  'txt',
  'text',
  'md',
  'markdown',
  'mkd',
  'mkdn',
  'mkdown',
  'ron'
]
var htmlExtensions = ['htm', 'html']

module.exports = function app(
  input,
  {stdin, text, html, diff, quiet, why}
) {
  var extensions = html ? htmlExtensions : textExtensions
  var defaultGlobs = ['{docs/**/,doc/**/,}*.{' + extensions.join(',') + '}']
  var silentlyIgnore
  var globs

  if (stdin) {
    if (input.length !== 0) {
      throw new Error('Do not pass globs with `--stdin`')
    }
  } else if (input.length === 0) {
    globs = defaultGlobs
    silentlyIgnore = true
  } else {
    globs = input
  }

  engine(
    {
      processor: unified(),
      files: globs,
      extensions: extensions,
      configTransform: transform,
      output: false,
      out: false,
      streamError: new PassThrough(),
      rcName: '.alexrc',
      packageField: 'alex',
      ignoreName: '.alexignore',
      silentlyIgnore: silentlyIgnore,
      frail: true,
      defaultConfig: transform()
    },
    function(err, code, result) {
      var out = report(err || result.files, {
        verbose: why,
        quiet: quiet
      })

      if (out) {
        console.error(out)
      }

      process.exit(code)
    }
  )

  function transform(options) {
    var settings = options || {}
    var plugins = [
      english,
      [profanities, {sureness: settings.profanitySureness}],
      [equality, {noBinary: settings.noBinary}]
    ]

    if (html) {
      plugins = [htmlParser, [rehype2retext, unified().use({plugins: plugins})]]
    } else if (!text) {
      plugins = [
        markdown,
        [frontmatter, ['yaml', 'toml']],
        [remark2retext, unified().use({plugins: plugins})]
      ]
    }

    plugins.push([filter, {allow: settings.allow}])

    /* istanbul ignore if - hard to check. */
    if (diff) {
      plugins.push(diff)
    }

    return {plugins: plugins}
  }
}
