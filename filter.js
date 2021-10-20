'use strict'

var control = require('remark-message-control')

module.exports = filter

function filter(options) {
  /* c8 ignore next */
  var settings = options || {}

  if (settings.allow && settings.deny) {
    throw new Error(
      'Do not provide both allow and deny configuration parameters'
    )
  }

  return control({
    name: 'alex',
    reset: Boolean(settings.deny),
    enable: settings.deny,
    disable: settings.allow,
    source: ['retext-equality', 'retext-profanities']
  })
}
