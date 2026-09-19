const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8')

test('legacy custom field definitions are read-only while visibility, width and order remain configurable', () => {
  const drawer = source('src/pages/system/asset-type-fields.vue')

  for (const type of ['text', 'number', 'date', 'select']) {
    assert.match(drawer, new RegExp(`${type}:`))
  }
  for (const copy of ['历史只读', '非 CMDB']) {
    assert.ok(drawer.includes(copy), `missing read-only boundary copy: ${copy}`)
  }

  assert.match(drawer, /_readOnlyDefinition/)
  assert.match(drawer, /visible:\s+!!f\.visible/)
  assert.match(drawer, /v-model="record\.width"/)
  assert.match(drawer, /width:\s+f\.width\s*\|\|\s*0/)
  assert.doesNotMatch(drawer, /_readOnlyDefinition:[\s\S]*?width:\s*field\.width/)
  assert.match(drawer, /moveUp\(index\)/)
  assert.match(drawer, /moveDown\(index\)/)
  assert.doesNotMatch(drawer, /新增自定义属性|addCustomField|removeCustomField/)
  assert.doesNotMatch(drawer, /v-model="record\.field_type"|v-model="record\.options"|mode="tags"/)
})

test('frontend service keeps historical attributes readable but exposes no value-write endpoint', () => {
  const services = source('src/services/admin.js')

  assert.match(services, /function getHostAssetAttributes\(id, zid\)[\s\S]*METHOD\.GET/)
  assert.doesNotMatch(services, /updateHostAssetAttributes/)
  assert.doesNotMatch(services, /\/attributes[^\n]*METHOD\.PUT/)
})

test('list and detail show legacy values without asset-field edit or save paths', () => {
  const list = source('src/pages/host/GenericDeviceList.vue')
  const detail = source('src/pages/host/GenericDeviceDetail.vue')

  for (const page of [list, detail]) {
    assert.match(page, /custom_attributes/)
    assert.match(page, /历史只读/)
    assert.match(page, /非 CMDB|不属于 CMDB/)
    assert.doesNotMatch(page, /<a-alert[^>]*message="(?:本页资产字段只读|监控侧资产字段只读)/)
    assert.doesNotMatch(page, /updateHostAssetAttributes|EDITABLE_FIELDS|DATE_FIELDS|editForm|isEditing/)
    assert.doesNotMatch(page, /tenant\.assets', 'update'/)
  }

  assert.doesNotMatch(detail, /hostUpdate|startEdit|handleSave/)
  assert.match(detail, /v-if="field\.custom"[\s\S]*?fieldValue\(detail, field\.key\)/)
  assert.match(detail, /displayFieldValue\(value\)[\s\S]*?value === null[\s\S]*?value === undefined[\s\S]*?value === ''/)
  assert.doesNotMatch(detail, /v-if="field\.custom"[\s\S]{0,180}fieldValue\(detail, field\.key\) \|\| '--'/)
  assert.match(detail, /safeExternalLink[\s\S]*?\['http:', 'https:'\]/)
  assert.match(detail, /rel="noopener noreferrer"/)
  assert.doesNotMatch(list, /editRow|saveRow|cancelRow|isEditableField/)
})

test('standard Zabbix tag editing remains available and uses the existing host update path', () => {
  const list = source('src/pages/host/GenericDeviceList.vue')

  assert.match(list, /编辑标签/)
  assert.match(list, /openTagEditor\(record\)/)
  assert.match(list, /saveTags\(\)/)
  const request = list.match(/hostUpdate\((\{[\s\S]*?\})\)\.then/)
  assert.ok(request, 'missing standard-tag update request')
  assert.match(request[1], /hostid:\s*this\.tagRecord\.hostid/)
  assert.match(request[1], /zid:\s*this\.tagRecord\.zid/)
  assert.match(request[1], /tags/)
  for (const forbidden of ['location', 'department', 'resource_id', 'mac', 'date_hw_install', 'date_hw_expiry', 'custom_attributes']) {
    assert.ok(!request[1].includes(forbidden), `tag request must not resend read-only field: ${forbidden}`)
  }
  assert.doesNotMatch(request[1], /\.\.\.this\.tagRecord/)
  assert.match(list, /tenant\.monitoring', 'update'/)
})

test('deprecated Zabbix inventory binding UI is historical read-only and cannot schedule or execute', () => {
  const binding = source('src/pages/system/asset-binding.vue')
  const services = source('src/services/admin.js')
  const config = source('src/pages/system/config.vue')

  for (const copy of ['旧设备绑定配置', '历史配置', '只读保留']) {
    assert.ok(binding.includes(copy), `missing deprecated binding boundary: ${copy}`)
  }
  assert.match(binding, /getSystemBindings/)
  assert.match(binding, /getSystemBinding/)
  assert.match(binding, /getSystemBindingHistory/)
  assert.match(binding, /metricMappingGet/)
  assert.match(binding, /metricMappingList/)
  assert.match(binding, /metricMappingHistory/)
  assert.match(binding, /data-testid="system-binding-detail-raw"/)
  assert.match(binding, /data-testid="metric-mapping-detail-raw"/)
  assert.match(binding, /data-testid="metric-mapping-table"/)
  assert.match(binding, /data-testid="metric-mapping-history-modal"/)
  assert.doesNotMatch(binding, /handleAdd|handleEdit|handleCopy|handleDelete|handleInit|handleSubmit/)
  assert.doesNotMatch(binding, /createSystemBinding|updateSystemBinding|deleteSystemBinding|initSystemBinding/)
  assert.doesNotMatch(binding, /监控指标绑定|新主机自动初始化|批量 inventory 写入/)

  for (const writer of [
    'systemUpdate', 'systemInit',
    'metricMappingCreate', 'metricMappingUpdate', 'metricMappingDelete', 'metricMappingExecute',
    'createSystemBinding', 'updateSystemBinding', 'deleteSystemBinding', 'initSystemBinding',
  ]) {
    assert.doesNotMatch(services, new RegExp(`function ${writer}\\b`), `deprecated writer service remains: ${writer}`)
  }

  for (const key of [
    'sync_inventory', 'sync_inventory_cron',
    'auto_metric_mapping_enabled', 'auto_metric_mapping_cron',
    'retry_failed_mapping_enabled', 'retry_failed_mapping_cron',
    'binding_auto_init_enabled', 'binding_auto_init_cron',
    'binding_retry_enabled', 'binding_retry_cron',
  ]) {
    assert.ok(config.includes(`'${key}'`), `deprecated task filter is missing: ${key}`)
  }
  assert.match(config, /!DEPRECATED_INVENTORY_TASK_KEYS\.has\(item\.config_key\)/)
})
