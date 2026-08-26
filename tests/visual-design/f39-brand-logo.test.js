const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const read = relative => fs.readFileSync(path.join(root, relative))
const source = relative => read(relative).toString('utf8')
const digest = relative => crypto.createHash('sha256').update(read(relative)).digest('hex')

function pngDimensions(relative) {
  const value = read(relative)
  assert.equal(value.subarray(1, 4).toString('ascii'), 'PNG')
  return [value.readUInt32BE(16), value.readUInt32BE(20)]
}

test('F39 packages the supplied QI-ANXIN brand family', () => {
  assert.deepEqual(pngDimensions('src/assets/img/qianxin-horizontal.png'), [1200, 391])
  assert.deepEqual(pngDimensions('src/assets/img/qianxin-vertical.png'), [900, 818])
  assert.deepEqual(pngDimensions('src/assets/img/qianxin-tiger.png'), [500, 240])
  assert.equal(
    digest('src/assets/img/logo.png'),
    digest('src/assets/img/qianxin-horizontal.png')
  )
  assert.equal(
    digest('public/logo.png'),
    digest('src/assets/img/qianxin-horizontal.png')
  )
})

test('F39 replaces the generic login lockup with the full Chinese brand logo', () => {
  const login = source('src/pages/login/Login.vue')
  assert.match(login, /class="smartops-login-brand-image"/)
  assert.match(login, /alt="奇安信 新一代网络安全领军者"/)
  assert.doesNotMatch(login, /smartops-login-brand-name/)
  assert.doesNotMatch(login, />SmartOps</)
  assert.match(login, /logoUrl:\s*require\('@\/assets\/img\/logo\.png'\)/)
  assert.match(login, /this\.logoUrl = infoRes\.data\.system_logo/)
})

test('F39 uses the wide brand in expanded navigation and tiger mark when collapsed', () => {
  const sideMenu = source('src/components/menu/SideMenu.vue')
  const sideStyle = source('src/components/menu/index.less')
  const header = source('src/layouts/header/AdminHeader.vue')

  assert.match(sideMenu, /collapsed \? brandMarkEmbeddedLogo : brandWideEmbeddedLogo/)
  assert.match(sideMenu, /qianxin-horizontal(?:-embedded)?\.png/)
  assert.match(sideMenu, /qianxin-tiger(?:-embedded)?\.png/)
  assert.match(sideStyle, /\.logo-brand\.is-expanded/)
  assert.match(sideStyle, /\.logo-brand\.is-collapsed/)
  assert.match(sideStyle, /object-fit:\s*contain/)
  assert.match(header, /isMobile \? brandMarkEmbeddedLogo : brandWideEmbeddedLogo/)
})
