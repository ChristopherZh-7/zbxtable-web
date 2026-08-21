const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildUserUpdatePayload,
  isValidPassword,
  isValidUsername,
  statusAfterResponse,
} = require('../../src/pages/system/user-validation')

test('validates usernames and passwords with the backend contract', () => {
  assert.equal(isValidUsername('ops.user-01'), true)
  assert.equal(isValidUsername('ab'), false)
  assert.equal(isValidUsername('中文用户'), false)
  assert.equal(isValidPassword('Strong-Password-01'), true)
  assert.equal(isValidPassword('short'), false)
  assert.equal(isValidPassword('', true), true)
})

test('builds an edit payload that can clear contacts without resetting a blank password', () => {
  const payload = buildUserUpdatePayload({
    username: 'immutable-name',
    password: '',
    role: 'user',
    email: '',
    phone: ' ',
    wechat: '',
    wechat_robot_key: '',
    ding_talk: '',
  }, {clearWechatRobotKey: true})

  assert.deepEqual(payload, {
    role: 'user',
    email: '',
    phone: '',
    wechat: '',
    ding_talk: '',
    wechat_robot_key: '',
  })
  assert.equal(Object.hasOwn(payload, 'username'), false)
  assert.equal(Object.hasOwn(payload, 'password'), false)
})

test('keeps the current switch state when the status request fails', () => {
  assert.equal(statusAfterResponse(0, false, 501), 0)
  assert.equal(statusAfterResponse(0, false, 200), 1)
  assert.equal(statusAfterResponse(1, true, 200), 0)
})
