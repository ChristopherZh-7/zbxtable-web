const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const asset = relative => fs.readFileSync(path.join(root, relative))

test('F41 packages RGBA navigation assets without changing the supplied dimensions', () => {
  const wide = asset('src/assets/img/qianxin-horizontal-embedded.png')
  const tiger = asset('src/assets/img/qianxin-tiger-embedded.png')
  const dimension = payload => [payload.readUInt32BE(16), payload.readUInt32BE(20), payload[25]]

  assert.deepEqual(dimension(wide), [1200, 391, 6])
  assert.deepEqual(dimension(tiger), [500, 240, 6])
})

test('F41 uses transparent dark-surface assets in expanded and collapsed navigation', () => {
  const component = source('src/components/menu/SideMenu.vue')
  const styles = source('src/components/menu/index.less')
  const logoBlock = styles.slice(styles.indexOf('.logo{'), styles.indexOf('/deep/'))

  assert.match(component, /qianxin-horizontal-embedded\.png/)
  assert.match(component, /qianxin-tiger-embedded\.png/)
  assert.match(logoBlock, /background:\s*#0a1f44/)
  assert.doesNotMatch(logoBlock, /background-color:\s*#fff/)
  assert.match(logoBlock, /box-shadow:\s*inset/)
  assert.match(logoBlock, /\.logo-brand\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/)
})

test('F41 extends the same embedded brand anchor to mobile and head layouts', () => {
  const component = source('src/layouts/header/AdminHeader.vue')
  const styles = source('src/layouts/header/index.less')
  const logoBlock = styles.match(/\.logo\s*\{[\s\S]*?\.trigger/)[0]

  assert.match(component, /qianxin-horizontal-embedded\.png/)
  assert.match(component, /qianxin-tiger-embedded\.png/)
  assert.match(logoBlock, /background:\s*#0a1f44/)
  assert.match(logoBlock, /box-shadow:\s*inset/)
  assert.match(logoBlock, /img\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/)
})
