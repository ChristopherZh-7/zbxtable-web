const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const source = p => fs.readFileSync(path.join(root,p),'utf8')
const {displaySystemText} = require('../../src/utils/presentation-copy')
const {normalizeMonitoringHealth} = require('../../src/utils/monitoring-health')

test('customer login subtitles are neutral in every supported locale', () => {
  const messages = require('../../src/pages/login/i18n').messages
  assert.equal(messages.CN.systemSubtitle, '统一监控与资产运维管理平台')
  assert.equal(messages.HK.systemSubtitle, '統一監控與資產運維管理平台')
  assert.equal(messages.US.systemSubtitle, 'Unified Monitoring and Asset Operations')
  for(const locale of Object.values(messages)){
    assert.doesNotMatch(locale.systemSubtitle, /Zabbix|iTop|SmartOps/i)
    assert.doesNotMatch(locale.copyright, /Zabbix|iTop|SmartOps/i)
  }
  assert.equal(require('../../src/config/default/setting.config').systemSubtitle,messages.CN.systemSubtitle)
})

test('navigation and CMDB headings use functional names while routes stay stable', () => {
  const routes=source('src/router/config.js')
  assert.match(routes,/path: "zabbix",[\s\S]*?name: "监控源管理"/)
  assert.match(routes,/import\("@\/pages\/system\/zabbix"\)/)
  const cmdb=source('src/pages/cmdb/index.vue')
  assert.match(cmdb,/配置管理中心统一维护资产档案/)
  assert.match(cmdb,/资产 ↔ 监控/)
  assert.match(cmdb,/itop_organization_id/)
  assert.match(cmdb,/displaySystemText\(value.summary\)/)
})

test('presentation translation preserves technical identifiers and URLs', () => {
  assert.equal(displaySystemText('iTop 与 Zabbix 通过 SmartOps 协作'),'配置管理中心 与 监控中心 通过 平台 协作')
  assert.equal(displaySystemText('zabbix_instance_unavailable /v1/zabbix http://zabbix-api:8080 itop_organization_id'),'zabbix_instance_unavailable /v1/zabbix http://zabbix-api:8080 itop_organization_id')
  assert.equal(displaySystemText('host-Zabbix-001 SmartOps-Local-Only!'),'host-Zabbix-001 SmartOps-Local-Only!')
  assert.equal(displaySystemText(null),'')
})

test('display-only health translation never changes server verdict or source data', () => {
  const health={state:'degraded',summary:'Zabbix 与 iTop 读取异常',reasons:['zabbix_unreachable'],enabled_item_count:4,fresh_item_count:1,configuration:{state:'drifted'},hostid:'zabbix-server-01'}
  const before=JSON.parse(JSON.stringify(health))
  const result=normalizeMonitoringHealth(health)
  assert.equal(result.summary,'监控中心 与 配置管理中心 读取异常')
  assert.equal(result.state,'degraded')
  assert.equal(result.configuration.state,'drifted')
  assert.equal(result.fresh_item_count,1)
  assert.equal(result.enabled_item_count,4)
  assert.equal(result.hostid,'zabbix-server-01')
  assert.deepEqual(result.reasons,['zabbix_unreachable'])
  assert.deepEqual(health,before)
})
