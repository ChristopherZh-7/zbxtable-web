const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('field model exposes exactly the four confirmed custom types', () => {
  const drawer = source('src/pages/system/asset-type-fields.vue')
  for (const type of ['text', 'number', 'date', 'select']) {
    assert.match(drawer, new RegExp(`value: '${type}'`))
  }
  assert.match(drawer, /新增自定义属性/)
  assert.match(drawer, /field\.custom && field\.field_type === 'select'/)
  assert.match(drawer, /历史值会保留/)
  assert.doesNotMatch(drawer, /formula|cascade|multi-select/)
})

test('dynamic attributes use dedicated tenant-scoped host endpoints', () => {
  const services = source('src/services/admin.js')
  assert.match(services, /getHostAssetAttributes/)
  assert.match(services, /updateHostAssetAttributes/)
  assert.match(services, /\/attributes' \+ suffix, METHOD\.PUT, \{ values \}/)
})

test('list and detail render typed custom values without flattening server ownership', () => {
  for (const page of [
    source('src/pages/host/GenericDeviceList.vue'),
    source('src/pages/host/GenericDeviceDetail.vue'),
  ]) {
    assert.match(page, /custom_attributes/)
    assert.match(page, /field_type === 'number'/)
    assert.match(page, /field_type === 'select'/)
    assert.match(page, /tenant\.assets', 'update'/)
    assert.match(page, /updateHostAssetAttributes/)
  }
})
