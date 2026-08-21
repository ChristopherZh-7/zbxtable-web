const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/

function isValidUsername(username) {
  return typeof username === 'string' && USERNAME_PATTERN.test(username.trim())
}

function isValidPassword(password, optional = false) {
  if (optional && !password) {
    return true
  }
  if (typeof password !== 'string') {
    return false
  }
  const length = new TextEncoder().encode(password).length
  return length >= 8 && length <= 72
}

function buildUserUpdatePayload(user, options = {}) {
  const payload = {
    role: user.role,
    email: (user.email || '').trim(),
    phone: (user.phone || '').trim(),
    wechat: (user.wechat || '').trim(),
    ding_talk: (user.ding_talk || '').trim(),
  }
  if (user.password) {
    payload.password = user.password
  }
  if (options.clearWechatRobotKey) {
    payload.wechat_robot_key = ''
  } else if (user.wechat_robot_key) {
    payload.wechat_robot_key = user.wechat_robot_key.trim()
  }
  return payload
}

function statusAfterResponse(currentStatus, enabled, responseCode) {
  return responseCode === 200 ? (enabled ? 0 : 1) : currentStatus
}

module.exports = {
  buildUserUpdatePayload,
  isValidPassword,
  isValidUsername,
  statusAfterResponse,
}
