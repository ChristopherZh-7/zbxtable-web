const CONFIG_MASK = '********'

const GROUP_KEYS = {
  system: [
    'system_name',
    'system_subtitle',
    'system_logo',
    'dash_top_lin_num',
    'dash_top_win_num',
    'webhook_url',
  ],
  email: [
    'email_from',
    'email_nickname',
    'email_secret',
    'email_host',
    'email_port',
    'email_isSSl',
  ],
  wechat: [
    'wechat_enabled',
    'wechat_agentid',
    'wechat_corpid',
    'wechat_secret',
  ],
}

const SECRET_CONFIG_KEYS = ['email_secret', 'wechat_secret']

function isAtomicCategory(category) {
  return Object.prototype.hasOwnProperty.call(GROUP_KEYS, category)
}

function isSecretConfigKey(key) {
  return SECRET_CONFIG_KEYS.includes(key)
}

function normalizeSecretValue(key, value) {
  if (!isSecretConfigKey(key)) {
    return {configured: false, value: value || ''}
  }
  const configured = value === CONFIG_MASK
  return {configured, value: configured ? '' : (value || '')}
}

function buildAtomicGroupRequest(category, configs, form, clearPending) {
  if (!isAtomicCategory(category)) {
    throw new Error(`Unsupported atomic configuration category: ${category}`)
  }
  const available = new Set((configs || []).map((item) => item.config_key))
  const values = {}
  GROUP_KEYS[category].forEach((key) => {
    if (available.has(key)) {
      const value = form && form[key]
      values[key] = value === undefined || value === null ? '' : String(value)
    }
  })
  const clearKeys = SECRET_CONFIG_KEYS.filter((key) =>
    GROUP_KEYS[category].includes(key) && clearPending && clearPending[key]
  )
  return {values, clear_keys: clearKeys}
}

module.exports = {
  CONFIG_MASK,
  GROUP_KEYS,
  SECRET_CONFIG_KEYS,
  buildAtomicGroupRequest,
  isAtomicCategory,
  isSecretConfigKey,
  normalizeSecretValue,
}
