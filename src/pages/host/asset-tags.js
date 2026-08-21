const ENV_OPTIONS = Object.freeze([
  {value: 'prod', label: '生产'},
  {value: 'stage', label: '预发布'},
  {value: 'test', label: '测试'},
  {value: 'dev', label: '开发'},
])

const LEVEL_OPTIONS = Object.freeze([
  {value: 'core', label: '核心'},
  {value: 'important', label: '重要'},
  {value: 'general', label: '一般'},
])

const APP_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/

function standardTagValues(tags) {
  return (Array.isArray(tags) ? tags : []).reduce((values, item) => {
    const name = String(item && item.tag || '').trim().toLowerCase()
    if (['tenant', 'env', 'app', 'level'].includes(name) && values[name] === undefined) {
      values[name] = String(item.value || '').trim()
    }
    return values
  }, {})
}

function standardTagState(tags, tenantCode) {
  const values = standardTagValues(tags)
  const envs = new Set(ENV_OPTIONS.map((item) => item.value))
  const levels = new Set(LEVEL_OPTIONS.map((item) => item.value))
  const missing = []
  if (!values.tenant || values.tenant !== String(tenantCode || '').trim()) missing.push('tenant')
  if (!envs.has(values.env)) missing.push('env')
  if (!APP_PATTERN.test(values.app || '')) missing.push('app')
  if (!levels.has(values.level)) missing.push('level')
  return {values, missing, compliant: missing.length === 0}
}

function buildStandardTagFilters(filters) {
  const source = filters || {}
  const tags = ['env', 'app', 'level']
    .map((tag) => ({tag, value: String(source[tag] || '').trim()}))
    .filter((item) => item.value)
  return tags.length ? JSON.stringify(tags) : undefined
}

function buildStandardTagPayload(tenantCode, form) {
  const source = form || {}
  return [
    {tag: 'tenant', value: String(tenantCode || '').trim()},
    {tag: 'env', value: String(source.env || '').trim()},
    {tag: 'app', value: String(source.app || '').trim()},
    {tag: 'level', value: String(source.level || '').trim()},
  ]
}

function optionLabel(options, value) {
  const found = options.find((item) => item.value === value)
  return found ? found.label : value || '--'
}

module.exports = {
  APP_PATTERN,
  ENV_OPTIONS,
  LEVEL_OPTIONS,
  buildStandardTagFilters,
  buildStandardTagPayload,
  optionLabel,
  standardTagState,
  standardTagValues,
}
