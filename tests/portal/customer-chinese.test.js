const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'../..'),source=p=>fs.readFileSync(path.join(root,p),'utf8')
const compiler=require('vue-template-compiler')
const {detailRows}=require('../../src/pages/cmdb/cmdb-model')

test('customer page templates use Chinese business labels instead of engineering banners',()=>{
  for(const p of ['src/pages/cmdb/index.vue','src/pages/cmdb/responsibilities/index.vue','src/pages/host/ConfigConsumption.vue']){
    const template=compiler.parseComponent(source(p)).template.content
    assert.doesNotMatch(template,/RESPONSIBILITY DIRECTORY|SMARTOPS USER|ITOP CONTACT|ZABBIX CLASSIFIED HOSTS|SOURCE OF TRUTH|CONFIGURATION AUTHORITY|ACTIVE TEAMS|Monitoring Service Template/)
    const compiled=compiler.compile(template)
    assert.deepEqual(compiled.errors,[],p)
  }
  assert.match(source('src/pages/cmdb/responsibilities/index.vue'),/团队与负责人/)
  assert.match(source('src/pages/host/ConfigConsumption.vue'),/label="监控模板"/)
})

test('diagnostic details remain available without occupying the default business view',()=>{
  const cmdb=source('src/pages/cmdb/index.vue'),config=source('src/pages/host/ConfigConsumption.vue')
  assert.match(cmdb,/<details[^>]*class="technical-details"><summary>组织技术详情<\/summary>/)
  assert.match(config,/<details class="technical-details"><summary>查看资产版本<\/summary>/)
  assert.match(config,/<details class="technical-details"><summary>诊断代码<\/summary>/)
  assert.doesNotMatch(config,/<details[^>]*\bopen(?:=|\s|>)/)
  assert.match(config,/record\.error_reason \|\| record\.error_code \|\| record\.reason/)
  assert.match(config,/selectedApplyAsset\.revision/)
  const monitoring=source('src/pages/system/zabbix.vue')
  assert.match(monitoring,/<summary>查看标识<\/summary>/)
  assert.match(monitoring,/<summary>连接地址<\/summary>/)
  assert.match(monitoring,/record\.url/)
})

test('asset detail translates known enum values without changing the source or unknown values',()=>{
  const asset={id:18,class:'Server',status:'production',business_criticity:'high',name:'真实资产',managementip:'192.0.2.10'}
  const before=JSON.stringify(asset),rows=detailRows(asset)
  assert.equal(rows.find(x=>x.key==='status').value,'生产')
  assert.equal(rows.find(x=>x.key==='business_criticity').value,'高')
  assert.equal(rows.find(x=>x.key==='managementip').value,'192.0.2.10')
  assert.equal(JSON.stringify(asset),before)
  assert.equal(detailRows({...asset,status:'vendor-state'}).find(x=>x.key==='status').value,'vendor-state')
  assert.equal(detailRows({...asset,business_criticity:'custom'}).find(x=>x.key==='business_criticity').value,'custom')
})

test('Chinese navigation aliases leave routes and technical service identity intact',()=>{
  const labels=require('../../src/router/i18n').messages.CN.assets
  assert.equal(labels.cmdb.name,'资产配置中心')
  assert.equal(labels['cmdb-responsibilities'].name,'运维基础资料')
  assert.equal(labels.configuration.name,'监控配置')
  assert.match(source('src/router/async/router.map.js'),/cmdbCenter/)
  assert.match(source('src/services/cmdb.js'),/X-CMDB-Mapping-Generation/)
  assert.match(source('src/pages/host/ScriptDiscovery.vue'),/\{\{ record\.item_key \}\}/)
  assert.doesNotMatch(source('src/pages/system/tenants/index.vue'),/\.filter\([^)]*harness/i)
  const selection=compiler.parseComponent(source('src/pages/system/tenants/select.vue')).template.content
  assert.doesNotMatch(selection,/tenant\.code/)
  assert.match(selection,/:value="tenant\.id"/)
  assert.match(selection,/tenant\.name/)
  assert.match(selection,/编号 \{\{ tenant\.id \}\}/)
})

test('Chinese workplace and screen labels do not fall back to decorative English',()=>{
  const screen=require('../../src/pages/screen/i18n').messages
  const workplace=require('../../src/pages/dashboard/i18n').messages
  assert.equal(screen.CN.screen_subtitle,'集中监控与运行态势')
  assert.equal(screen.CN.panel_cpu_top,'Linux CPU 排行')
  assert.equal(screen.CN.panel_mem_top,'Windows 内存排行')
  assert.equal(screen.US.screen_subtitle,'OPERATION COMMAND CENTER')
  assert.equal(workplace.CN.linux_systems_title,'Linux 主机排行')
  assert.equal(workplace.CN.windows_systems_title,'Windows 主机排行')
  assert.match(source('src/pages/host/GenericDeviceList.vue'),/历史只读 · 非 CMDB/)
})

test('legacy binding controls preserve read-only behavior without engineering notices',()=>{
  const binding=source('src/pages/system/asset-binding.vue')
  assert.match(binding,/只读保留/)
  assert.doesNotMatch(binding,/handleAdd|handleEdit|handleDelete|handleInit|handleSubmit|metricMappingExecute/)
  assert.doesNotMatch(binding,/<a-alert/)
  assert.match(binding,/不会再执行或写入监控中心/)
  assert.doesNotMatch(binding,/写入 Zabbix/)
  assert.match(source('src/pages/host/GenericDeviceDetail.vue'),/历史只读 · 非 CMDB/)
  assert.doesNotMatch(source('src/pages/host/GenericDeviceDetail.vue'),/hostUpdate|handleSave|updateHostAssetAttributes/)
})

test('rendered screen components use Chinese ranking and total labels',()=>{
  const page=source('src/pages/screen/index.vue')
  assert.doesNotMatch(page,/\+ ' TOP'/)
  assert.equal((page.match(/\+ ' 排行'/g)||[]).length,2)
  assert.match(source('src/pages/screen/components/SeverityRose.vue'),/subtext: '合计'/)
})
