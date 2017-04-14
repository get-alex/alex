'use strict';

var control = require('remark-message-control');

module.exports = filter;

function filter(options) {
  var settings = options || /* istanbul ignore next */ {};
  return control({
    name: 'alex',
    disable: settings.allow,
    source: ['retext-equality', 'retext-profanities']
  });
}
