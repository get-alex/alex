import remarkMessageControl from 'remark-message-control'

export function filter(options) {
  /* c8 ignore next */
  const settings = options || {}

  if (settings.allow && settings.deny) {
    throw new Error(
      'Do not provide both allow and deny configuration parameters'
    )
  }

  return remarkMessageControl({
    name: 'alex',
    reset: Boolean(settings.deny),
    enable: settings.deny,
    disable: settings.allow,
    source: ['retext-equality', 'retext-profanities']
  })
}
