const CONFIGURATION_SCOPES = [
  {value: 'current', label: '当前', caption: '当前 Organization 与 GEN 下可执行的记录'},
  {value: 'archive', label: '归档', caption: '映射切换后保留的不可变记录'},
  {value: 'legacy', label: '遗留冻结', caption: '缺少 CMDB 身份的旧数据，只读保留'},
]

const ERROR_MESSAGES = {
  agentless_unconfigured: '平台尚未配置 Agentless 接入档案，请联系平台运维。',
  agentless_catalog_unavailable: '服务端接入档案不可用，请联系平台运维核验配置文件。',
  agentless_denied: '该接入档案不属于当前租户、Organization、实例或 CI 类型。',
  agentless_profile_stale: '接入档案已变更，请重新选择档案并保存场景。',
  agentless_credential_unavailable: '服务端凭据引用不可用，请联系平台运维核验；不要在页面填写密码。',
  agentless_target_denied: 'CI 管理 IP 不在档案允许的地址范围，请核对资产与接入范围。',
  agentless_template_unsafe: '模板已偏离批准的协议安全设置，请联系平台运维核验。',
  agentless_configuration_conflict: 'Host 存在受管配置冲突，未覆盖；请先核对现有接口与档案。',
  agentless_profile_required: '该 Host 已使用 Agentless 档案，请选择对应档案后重新应用。',
  agentless_transport_unsafe: 'Zabbix API 的安全连接不可用，请联系平台运维核验证书与 CA。',
  configuration_cmdb_identity_required: '旧的裸 Host 入口已停用；请从当前 iTop CI 重新应用场景。',
  configuration_context_stale: 'Organization 或 GEN 已变化；请刷新后重新操作。',
  mapping_context_stale: 'Organization 或 GEN 已变化；请刷新后重新操作。',
  mapping_generation_mismatch: 'CMDB 映射世代已更新；旧上下文不会继续执行。',
  configuration_asset_revision_stale: 'CI revision 已更新；请重新检查关系与监控绑定。',
  configuration_scenario_version_stale: '场景版本已更新；请重新选择场景。',
  configuration_scenario_stale: '场景版本已更新；请重新选择场景。',
  configuration_scenario_disabled: '场景已停用；请选择其他启用场景。',
  configuration_scenario_in_use: '该场景已被任务使用，不能删除。',
  configuration_application_relation_changed: 'CI 与应用系统的关系已变化；请在 iTop 核对后重新应用。',
  configuration_application_mismatch: '所选 CI 不属于该 ApplicationSolution。',
  configuration_application_inactive: '当前 ApplicationSolution 已停用；请在 iTop 恢复后重新应用。',
  configuration_asset_retired: '该 CI 已退役，不允许继续应用监控策略。',
  configuration_binding_stale: 'F49 监控绑定已变化；请重新确认 Host。',
  configuration_binding_missing: '该 CI 没有可用的 F49 绑定；请先在 CMDB 配置中心关联监控主机。',
  configuration_binding_required: '该 CI 没有可用的 F49 绑定；请先在 CMDB 配置中心关联监控主机。',
  configuration_binding_ambiguous: '该 CI 的 F49 绑定不唯一；请先消除冲突。',
  configuration_host_out_of_scope: '绑定 Host 已不在当前租户范围；请核对 F49 绑定。',
  configuration_host_missing: '绑定的 Zabbix Host 已不存在；请修复 F49 绑定。',
  configuration_template_missing: '场景模板已不可用；请更新场景。',
  configuration_task_version_stale: '任务版本已更新；请刷新后再重试。',
  configuration_version_stale: '记录版本已更新；请刷新后再操作。',
  configuration_legacy_frozen: '该记录缺少完整 CMDB 身份，已冻结为只读历史。',
  configuration_legacy_unresolved: '该记录缺少完整 CMDB 身份，已冻结为只读历史。',
  configuration_archived: '该记录已归档，不会重新执行。',
  configuration_transient: 'iTop 或 Zabbix 暂时不可用；系统会在限定次数内重试。',
  configuration_target_invalid: 'iTop CI、Zabbix Host、Host Group 或 Template 已不可用；请核对 F49 绑定与场景。',
  configuration_denied: '该记录不属于当前租户或 Organization。',
  configuration_validation: '请求参数不符合当前配置消费契约。',
}

function emptyConfigurationPage(scope = 'current', pageSize = 20) {
  return {items: [], total: 0, page: 1, page_size: pageSize, scope}
}

function normalizeConfigurationPage(data, scope = 'current', pageSize = 20) {
  const source = data || {}
  const items = Array.isArray(source) ? source : Array.isArray(source.items) ? source.items : []
  return {
    items,
    total: Math.max(0, Number(Array.isArray(source) ? source.length : source.total) || 0),
    page: Math.max(1, Number(source.page) || 1),
    page_size: Math.max(1, Number(source.page_size || source.limit) || pageSize),
    scope: String(source.scope || source.partition || scope),
  }
}

function configurationContextKey(context, tenantID) {
  const source = context || {}
  const organizationID = Number(source.organization_id) || 0
  const generation = Number(source.generation) || 0
  const normalizedTenantID = Number(tenantID) || 0
  return normalizedTenantID > 0 && organizationID > 0 && generation > 0
    ? `${normalizedTenantID}:${organizationID}:${generation}`
    : ''
}

function scenarioApplicationID(scenario) {
  const source = scenario || {}
  return Number(source.application_id || source.application_solution_id || source.application && source.application.id) || 0
}

function scenarioApplicationName(scenario) {
  const source = scenario || {}
  return String(source.application_name || source.application_name_snapshot || source.application && source.application.name || '—')
}

function scenarioAssetClass(scenario) {
  const source = scenario || {}
  return String(source.asset_class || source.ci_class || '')
}

function taskCIIdentity(task) {
  const source = task || {}
  const ci = source.ci || source.asset || source.ci_snapshot || {}
  return {
    class: String(source.asset_class || source.ci_class || ci.class || ci.asset_class || ''),
    id: Number(source.asset_id || source.ci_id || ci.id || ci.asset_id) || 0,
    name: String(source.asset_name || source.ci_name || ci.name || ci.name_snapshot || '—'),
    revision: String(source.expected_revision || source.asset_revision || source.ci_revision || ci.revision || '—'),
  }
}

function taskHostSnapshot(task) {
  const source = task || {}
  const host = source.host_snapshot || source.host || {}
  return {
    zid: Number(source.zid || host.zid) || 0,
    host_id: String(source.host_id || source.hostid || host.host_id || host.hostid || '—'),
    host_name: String(source.host_name || host.host_name || host.name || '—'),
    instance_name: String(source.instance_name || source.zabbix_instance_name || host.instance_name || '—'),
  }
}

function relationApplications(relations, asset) {
  const source = relations || {}
  const nodes = Array.isArray(source.nodes) ? source.nodes : []
  const edges = Array.isArray(source.edges) ? source.edges : []
  const originKey = asset && asset.key ? String(asset.key) : `${asset && asset.class || ''}:${Number(asset && asset.id) || 0}`
  const nodeKey = (node) => node && node.key ? String(node.key) : `${node && node.class || ''}:${Number(node && node.id) || 0}`
  const adjacent = new Set([originKey])
  edges.forEach((edge) => {
    const from = String(edge && edge.from || '')
    const to = String(edge && edge.to || '')
    if (from === originKey && to) adjacent.add(to)
    if (to === originKey && from) adjacent.add(from)
  })
  const candidates = nodes.filter((node) => node && node.class === 'ApplicationSolution' && adjacent.has(nodeKey(node)))
  if (asset && asset.class === 'ApplicationSolution') candidates.push(asset)
  const seen = new Set()
  return candidates.filter((item) => {
    const key = nodeKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function monitoringIdentity(monitoring) {
  const source = monitoring || {}
  const binding = source.binding || null
  const host = source.host || null
  return {
    binding,
    host,
    bound: Boolean(binding && host),
    binding_id: Number(binding && binding.id) || 0,
    binding_version: Number(binding && (binding.version || binding.binding_version)) || 0,
    binding_updated_at: binding && (binding.updated_at || binding.binding_updated_at) || '',
    zid: Number(host && host.zid || binding && binding.zid) || 0,
    host_id: String(host && (host.host_id || host.hostid) || binding && (binding.host_id || binding.hostid) || ''),
    host_name: String(host && (host.host_name || host.name) || ''),
    instance_name: String(host && host.instance_name || ''),
  }
}

function applyEligibility(asset, applications, monitoring, scenario) {
  if (!asset || !scenario) return {ready: false, code: 'selection_required', message: '请选择场景与 iTop CI。'}
  const revision = String(asset.revision || '')
  if (!revision) return {ready: false, code: 'asset_revision_missing', message: '该 CI 缺少 revision，不能建立并发快照。'}
  const expectedClass = scenarioAssetClass(scenario)
  if (expectedClass && String(asset.class) !== expectedClass) return {ready: false, code: 'asset_class_mismatch', message: `该场景只适用于 ${expectedClass} CI。`}
  const applicationID = scenarioApplicationID(scenario)
  const matchesApplication = asset.class === 'ApplicationSolution'
    ? Number(asset.id) === applicationID
    : (applications || []).some((item) => Number(item.id) === applicationID)
  if (!matchesApplication) return {ready: false, code: 'configuration_application_mismatch', message: ERROR_MESSAGES.configuration_application_mismatch}
  const host = monitoringIdentity(monitoring)
  if (!host.bound) return {ready: false, code: 'configuration_binding_required', message: ERROR_MESSAGES.configuration_binding_required}
  return {ready: true, code: 'ready', message: '身份与关系已就绪，可以建立不可变任务快照。'}
}

function configurationFailureMessage(code, fallback) {
  return ERROR_MESSAGES[String(code || '')] || String(fallback || '处理失败，请刷新后重试。')
}

function retryableConfigurationTask(task) {
  const source = task || {}
  const contextState = String(source.record_state || source.context_state || source.scope || 'current')
  if (contextState !== 'current' || String(source.status) !== 'failed') return false
  if (source.retryable === false || source.blocked === true) return false
  // max_retry limits unattended execution only. A tenant administrator may
  // explicitly retry after the dependency has recovered; the API revalidates
  // every immutable CMDB/F49 snapshot before it resets the automatic counter.
  return true
}

function agentlessProfilesForScenario(resources, zid, assetClass) {
  return ((resources || {}).agentless_profiles || []).filter((profile) =>
    Number(profile.zid) === Number(zid) && Array.isArray(profile.asset_classes) &&
    profile.asset_classes.includes(String(assetClass || '')) &&
    /^[a-z0-9][a-z0-9_-]{1,63}$/.test(profile.id || '') && /^[a-f0-9]{64}$/.test(profile.digest || '')
  )
}

function agentlessSelectionPayload(form, resources) {
  if (!form.agentless_profile_id) return {}
  const profile = agentlessProfilesForScenario(resources, form.zid, form.asset_class)
    .find(item => item.id === form.agentless_profile_id)
  if (!profile || profile.digest !== form.expected_agentless_digest ||
      String(profile.template_id) !== String(form.template_id)) {
    throw new Error(ERROR_MESSAGES.agentless_profile_stale)
  }
  return {agentless_profile_id: profile.id, expected_agentless_digest: profile.digest}
}

function agentlessProtocolLabel(protocol) {
  return {snmp_v2c: 'SNMP v2c', snmp_v3: 'SNMP v3 · authPriv', http: 'HTTP · 无认证', https: 'HTTPS · 证书校验'}[protocol] || '未知协议'
}

module.exports = {
  agentlessProfilesForScenario,
  agentlessSelectionPayload,
  agentlessProtocolLabel,
  CONFIGURATION_SCOPES,
  applyEligibility,
  configurationContextKey,
  configurationFailureMessage,
  emptyConfigurationPage,
  monitoringIdentity,
  normalizeConfigurationPage,
  relationApplications,
  retryableConfigurationTask,
  scenarioApplicationID,
  scenarioApplicationName,
  scenarioAssetClass,
  taskCIIdentity,
  taskHostSnapshot,
}
