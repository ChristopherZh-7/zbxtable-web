const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')

test('F40 moves the complete brand from the dark story into the white login workbench', () => {
  const login = source('src/pages/login/Login.vue')
  const story = login.match(/<section class="smartops-login-story"[\s\S]*?<\/section>/)[0]
  const workbench = login.match(/<main class="smartops-login-workbench"[\s\S]*?<\/main>/)[0]

  assert.doesNotMatch(story, /smartops-login-brand-image/)
  assert.match(story, /smartops-login-context[\s\S]*?\{\{\s*systemName\s*\}\}/)
  assert.match(workbench, /<h2>\{\{\s*systemName\s*\}\}<\/h2>/)
  assert.match(workbench, /smartops-login-brand-image/)
  assert.match(workbench, /奇安信 新一代网络安全领军者/)
  assert.match(login, /\.smartops-login-workbench\s*\{[\s\S]*?background:\s*#fff;/)
  assert.match(login, /\.smartops-login-brand\s*\{[\s\S]*?margin-bottom:\s*34px;/)
})

test('F40 keeps side navigation branding inside one structural masthead', () => {
  const side = source('src/components/menu/index.less')
  const logoBlock = side.slice(side.indexOf('.logo{'), side.indexOf('/deep/'))

  assert.match(logoBlock, /height:\s*64px/)
  assert.match(logoBlock, /border-bottom:\s*1px solid/)
  assert.match(logoBlock, /\.logo-brand\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/)
  assert.doesNotMatch(logoBlock, /border-left:\s*3px solid #ffd100/)
  assert.match(logoBlock, /object-fit:\s*contain/)
})

test('F40 makes the mobile and top header logo area a full-height structural base', () => {
  const header = source('src/layouts/header/index.less')
  const logoBlock = header.match(/\.logo\s*\{[\s\S]*?\.trigger/)[0]

  assert.match(logoBlock, /min-width:\s*96px/)
  assert.match(logoBlock, /height:\s*64px/)
  assert.match(logoBlock, /border-right:\s*1px solid/)
  assert.match(logoBlock, /img\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?object-fit:\s*contain/)
})
