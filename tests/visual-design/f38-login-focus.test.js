const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const loginPath = path.resolve(__dirname, '../../src/pages/login/Login.vue')
const loginSource = fs.readFileSync(loginPath, 'utf8')

test('F38 removes the residual purple login focus palette', () => {
  assert.doesNotMatch(loginSource, /#667eea/i)
  assert.doesNotMatch(loginSource, /#764ba2/i)
  assert.doesNotMatch(loginSource, /rgba\(102,\s*126,\s*234/i)
})

test('F38 keeps one SmartOps focus boundary on the affix wrapper', () => {
  assert.match(loginSource, /custom-input\.ant-input-affix-wrapper:focus-within/)
  assert.match(loginSource, /border:\s*1px solid #cbd6e2/)
  assert.match(loginSource, /border-color:\s*#1b5a96/)
  assert.match(loginSource, /box-shadow:\s*0 0 0 2px rgba\(27,\s*90,\s*150,\s*0\.1\)/)
  assert.match(loginSource, /custom-input\.ant-input-affix-wrapper \.ant-input[\s\S]*?height:\s*48px/)
  assert.match(loginSource, /custom-input\.ant-input-affix-wrapper \.ant-input:focus[\s\S]*?border:\s*0;[\s\S]*?box-shadow:\s*none;/)
})

test('F38 retains the original login fields and submit flow', () => {
  assert.match(loginSource, /v-decorator="\['name'/)
  assert.match(loginSource, /v-decorator="\['password'/)
  assert.match(loginSource, /@submit="onSubmit"/)
  assert.match(loginSource, /login\(name, password\)/)
})
