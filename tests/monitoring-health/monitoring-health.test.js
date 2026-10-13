const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  interfaceAvailabilityLabel,
  monitoringConfigurationMeta,
  monitoringHealthMeta,
  monitoringReasonLabel,
  normalizeMonitoringHealth,
} = require('../../src/utils/monitoring-health')

const root = path.resolve(__dirname, '../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const {ALL_DEVICE_TYPE, monitoringHostTypeFilter, allMonitoringDeviceFields, unclassifiedMonitoringHosts} = require('../../src/pages/host/all-monitoring-devices')

test('overview preserves every unclassified monitoring Host without assigning a CMDB type', () => {
  const emptyType = {hostid: '2', type_code: '', monitoring_health: {state: 'healthy'}}
  const legacyType = {hostid: '3', type_code: 'RETIRED_TYPE', monitoring_health: {state: 'degraded'}}
  const data = {VM_LIN: [{hostid: '1'}], '': [emptyType], RETIRED_TYPE: [legacyType]}
  assert.deepEqual(unclassifiedMonitoringHosts([{type_code: 'VM_LIN'}], data), [emptyType, legacyType])
  assert.equal(emptyType.type_code, '')
  assert.equal(unclassifiedMonitoringHosts([], data).length, 3)
  assert.match(source('src/pages/dashboard/overview-redesign.vue'), /unclassifiedMonitoringHosts\(this\.assetTypes, dataMap\)/)
})

test('all monitoring devices uses server pagination without requiring Inventory classification', () => {
  assert.equal(monitoringHostTypeFilter(ALL_DEVICE_TYPE), '')
  assert.equal(monitoringHostTypeFilter('VM_LIN'), 'VM_LIN')
  assert.deepEqual(allMonitoringDeviceFields().map(field => field.key), ['name', 'interfaces', 'instance_name', 'available'])
  assert.ok(allMonitoringDeviceFields().every(field => field.visible && !field.custom))
  const browser = source('src/pages/host/AssetBrowser.vue')
  assert.match(browser, /全部监控设备/)
  assert.match(browser, /hostList\(\{page: 1, limit: 1\}\)/)
  assert.match(browser, /code === ALL_DEVICE_TYPE/)
  const list = source('src/pages/host/GenericDeviceList.vue')
  assert.match(list, /hosttype: monitoringHostTypeFilter\(this\.effectiveTypeCode\)/)
  assert.match(list, /this\.pagination\.total = res\.data\.total/)
})

test('shared health policy exposes every server-owned collection state', () => {
  const expectations = {
    disabled: ['已停用', 'default'],
    waiting_first_data: ['等待首采', 'processing'],
    healthy: ['采集健康', 'success'],
    degraded: ['采集降级', 'warning'],
    unavailable: ['监控不可用', 'error'],
    unknown: ['健康未知', 'default'],
  }
  for (const [state, [label, status]] of Object.entries(expectations)) {
    const health = normalizeMonitoringHealth({state})
    assert.equal(health.label, label)
    assert.equal(monitoringHealthMeta(health).status, status)
  }
})

test('missing or unrecognized verdicts fail closed even when legacy availability is green', () => {
  assert.equal(normalizeMonitoringHealth().state, 'unknown')
  assert.equal(normalizeMonitoringHealth({available: 1}).state, 'unknown')
  assert.equal(normalizeMonitoringHealth({state: 'online'}).state, 'unknown')
  assert.equal(normalizeMonitoringHealth({state: 'healthy'}).state, 'healthy')
})

test('configuration and reasons stay separate from collection health', () => {
  const health = normalizeMonitoringHealth({
    state: 'degraded',
    reasons: ['configuration_not_ready', 'required_template_missing:10001'],
    configuration: {state: 'drifted', latest_success_task_id: '19'},
  })
  assert.equal(health.configuration.state, 'drifted')
  assert.equal(health.configuration.latest_success_task_id, 19)
  assert.equal(monitoringConfigurationMeta(health.configuration).label, '配置存在漂移')
  assert.equal(monitoringReasonLabel(health.reasons[1]), '必需模板缺失：10001')
  assert.equal(monitoringReasonLabel('f24_managed_host_group_missing'), '最近配置记录缺少可信的受管主机组依据')
  assert.equal(monitoringReasonLabel('f24_managed_host_group_out_of_scope'), '最近配置的受管主机组已不在租户授权范围')
  assert.equal(monitoringReasonLabel('zabbix_managed_host_group_missing'), '监控主机已离开最近配置的受管主机组')
  assert.equal(monitoringReasonLabel('cmdb_application_inactive'), '配置管理中心中当前应用系统已停用')
  assert.equal(monitoringReasonLabel('cmdb_mapping_context_stale'), '校验期间配置组织映射已变更，请重试')
})

test('interface availability remains explicitly weaker than collection health', () => {
  assert.equal(interfaceAvailabilityLabel(1), '接口可用')
  assert.equal(interfaceAvailabilityLabel(2), '接口不可用')
  assert.equal(interfaceAvailabilityLabel(0), '接口状态未知')
  assert.equal(monitoringReasonLabel('active_agent_availability_unknown'), '主动 Agent 可用性尚无证据')
  assert.equal(monitoringReasonLabel('passive_agent_interface_availability_unknown'), '采集接口可用性尚无证据')
  assert.equal(monitoringReasonLabel('passive_agent_item_interface_id_missing'), '监控项缺少监控中心接口 ID')
  assert.equal(monitoringReasonLabel('snmp_item_interface_missing'), '监控项引用的监控中心接口不存在')
  assert.equal(monitoringReasonLabel('jmx_item_interface_type_mismatch'), '监控项引用的监控中心接口类型不匹配')
})

test('Agent recovery remains degraded until the server confirms a new value', () => {
  const health = normalizeMonitoringHealth({
    state: 'degraded', active_available: '1', fresh_item_count: 1,
    reasons: ['active_agent_recovery_pending'], configuration: {state: 'ready'},
  })
  assert.equal(health.state, 'degraded')
  assert.equal(monitoringHealthMeta(health).color, 'orange')
  assert.equal(monitoringReasonLabel(health.reasons[0]), '主动 Agent 等待新采集值确认恢复')
})

test('CMDB, device list and overview consume the shared server verdict', () => {
  const cmdb = source('src/pages/cmdb/index.vue')
  const devices = source('src/pages/host/GenericDeviceList.vue')
  const detailPages = [
    'GenericDeviceDetail.vue',
    'linuxDetail.vue',
    'winDetail.vue',
    'netDetail.vue',
    'serDetail.vue',
  ].map(name => source(`src/pages/host/${name}`))
  const overview = source('src/pages/dashboard/overview-redesign.vue')
  for (const page of [cmdb, devices, overview]) assert.match(page, /monitoring-health/)
  for (const page of detailPages) {
    assert.match(page, /MonitoringHealthCard/)
    assert.match(page, /detail\s*&&\s*detail\.monitoring_health/)
  }
  assert.match(cmdb, /collection_health/)
  assert.match(devices, /monitoring_health/)
  assert.match(detailPages[0], /interfaceAvailabilityLabel/)
  assert.match(detailPages[0], /field\.key === 'available'[\s\S]*?接口可用性/)
  assert.match(overview, /monitoring_health/)
  assert.doesNotMatch(devices, /采集正常/)
  for (const page of detailPages) assert.doesNotMatch(page, />正常<\/a-tag>/)
  assert.doesNotMatch(overview, /available\s*==\s*1\s*&&/)
})


const monitoringTagBindings = () => {
  const bindings = [...source('src/components/MonitoringHealthCard.vue').matchAll(/<a-tag\s+:color="([^"]+)"/g)].map(match => match[1])
  assert.equal(bindings.length, 2)
  return bindings
}

const assertRealMonitoringTag = (family, state, expectedColor) => {
  const Tag = require('ant-design-vue/lib/tag/Tag').default
  const healthMeta = monitoringHealthMeta({state: family === 'collection' ? state : 'unknown'})
  const configurationMeta = monitoringConfigurationMeta({state: family === 'configuration' ? state : 'unknown'})
  const meta = family === 'collection' ? healthMeta : configurationMeta
  const expression = monitoringTagBindings()[family === 'collection' ? 0 : 1]
  const color = new Function('healthMeta', 'configurationMeta', `return (${expression})`)(healthMeta, configurationMeta)
  assert.equal(color, expectedColor)
  const vm = {$props: {color}}
  vm.isPresetColor = Tag.methods.isPresetColor.bind(vm)
  const classes = Tag.methods.getTagClassName.call(vm, 'ant-tag')
  assert.equal(classes['ant-tag'], true)
  assert.equal(Boolean(classes['ant-tag-has-color']), false)
  assert.equal(Tag.methods.getTagStyle.call(vm).backgroundColor, undefined)
  if (expectedColor) assert.equal(classes[`ant-tag-${expectedColor}`], true)
  else {
    assert.equal(meta.color, 'default')
    assert.equal(meta.status, 'default')
  }
  return meta
}

test('ISSUE048 collection tags keep the real neutral and preset Ant Tag branches', () => {
  assert.equal(assertRealMonitoringTag('collection', 'unknown', undefined).label, '健康未知')
  assert.equal(assertRealMonitoringTag('collection', 'disabled', undefined).label, '已停用')
  for (const [state, color] of Object.entries({waiting_first_data: 'blue', healthy: 'green', degraded: 'orange', unavailable: 'red'})) {
    assertRealMonitoringTag('collection', state, color)
  }
})

test('ISSUE048 configuration tags keep the real neutral and preset Ant Tag branches', () => {
  assert.equal(assertRealMonitoringTag('configuration', 'unknown', undefined).label, '配置状态未知')
  for (const [state, color] of Object.entries({ready: 'green', not_applied: 'orange', drifted: 'red', unbound: 'orange'})) {
    assertRealMonitoringTag('configuration', state, color)
  }
})
