const {displaySystemText} = require('./presentation-copy')

const HEALTH_META = {
  disabled: {
    status: 'default', color: 'default', label: '已停用', tone: 'disabled',
    summary: '监控主机已停用，不参与采集健康判定。',
  },
  waiting_first_data: {
    status: 'processing', color: 'blue', label: '等待首采', tone: 'waiting',
    summary: '监控主机已启用且配置可判定，但尚未收到第一条监控值。',
  },
  healthy: {
    status: 'success', color: 'green', label: '采集健康', tone: 'healthy',
    summary: '关键监控证据处于可解释的新鲜度窗口内。',
  },
  degraded: {
    status: 'warning', color: 'orange', label: '采集降级', tone: 'degraded',
    summary: '采集证据存在缺口或异常，请按原因处理。',
  },
  unavailable: {
    status: 'error', color: 'red', label: '监控不可用', tone: 'unavailable',
    summary: '当前无法从监控中心读取监控运行态。',
  },
  unknown: {
    status: 'default', color: 'default', label: '健康未知', tone: 'unknown',
    summary: '暂无服务端健康证据，不能判定采集健康。',
  },
}

const CONFIGURATION_META = {
  ready: {status: 'success', color: 'green', label: '配置已应用', tone: 'ready'},
  not_applied: {status: 'warning', color: 'orange', label: '配置未应用', tone: 'not-applied'},
  drifted: {status: 'error', color: 'red', label: '配置存在漂移', tone: 'drifted'},
  unbound: {status: 'warning', color: 'orange', label: '绑定未就绪', tone: 'unbound'},
  unknown: {status: 'default', color: 'default', label: '配置状态未知', tone: 'unknown'},
}

const REASON_LABELS = {
  agentless_recovery_pending: '免代理采集等待新采集值确认恢复',
  agentless_profile_stale: '免代理采集档案已变更，需重新选择并应用',
  agentless_catalog_unavailable: '服务端免代理采集档案不可用',
  agentless_denied: '免代理采集档案已不属于当前身份范围',
  active_agent_unavailable: '主动 Agent 当前不可用',
  active_agent_availability_unknown: '主动 Agent 可用性尚无证据',
  active_agent_recovery_pending: '主动 Agent 等待新采集值确认恢复',
  cmdb_authority_unavailable: '当前无法核验配置项真值',
  cmdb_application_inactive: '配置管理中心中当前应用系统已停用',
  cmdb_application_missing: '配置管理中心中当前应用系统已不存在',
  cmdb_application_organization_mismatch: '应用系统已不属于当前配置组织',
  cmdb_binding_missing_or_stale: 'CMDB 与监控中心绑定缺失或已过期',
  cmdb_ci_lifecycle_invalid: '配置项生命周期已不允许当前配置',
  cmdb_ci_missing: '配置管理中心中当前配置项已不存在',
  cmdb_ci_revision_stale: '配置项已变更，需重新确认并应用配置',
  cmdb_ci_revision_unavailable: '配置项版本不可核验',
  cmdb_mapping_missing_or_stale: '当前租户的配置组织映射缺失或已过期',
  cmdb_mapping_context_stale: '校验期间配置组织映射已变更，请重试',
  configuration_not_ready: '监控配置尚未就绪',
  enabled_item_missing: '没有已启用的监控项',
  f24_success_missing: '尚无成功的配置应用记录',
  f24_application_requirement_invalid: '最近配置记录缺少可信的应用系统依据',
  f24_managed_host_group_missing: '最近配置记录缺少可信的受管主机组依据',
  f24_managed_host_group_out_of_scope: '最近配置的受管主机组已不在租户授权范围',
  f24_scenario_stale: '监控场景已变更或停用，需重新应用',
  first_value_not_received: '尚未收到首条监控值',
  f24_template_requirement_invalid: '最近配置记录缺少可信模板依据',
  health_evidence_missing: '缺少足够的采集证据',
  health_projection_unavailable: '监控健康投影暂不可用',
  host_disabled: '监控主机已停用',
  host_missing: '监控主机不存在',
  only_stale_values: '仅有超过新鲜度窗口的监控值',
  supported_item_missing: '没有处于支持状态的监控项',
  zabbix_instance_unavailable: '监控源当前不可用',
  zabbix_query_failed: '监控中心运行态读取失败',
  zabbix_managed_host_group_missing: '监控主机已离开最近配置的受管主机组',
  zabbix_unreachable: '监控中心当前不可达',
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizedReasons(value) {
  return Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : []
}

function normalizeMonitoringConfiguration(value) {
  const source = asObject(value)
  const state = Object.prototype.hasOwnProperty.call(CONFIGURATION_META, String(source.state || ''))
    ? String(source.state)
    : 'unknown'
  const meta = CONFIGURATION_META[state]
  return {
    ...source,
    state,
    label: meta.label,
    severity: meta.status,
    reasons: normalizedReasons(source.reasons),
    explicit_requirements: source.explicit_requirements === true,
    latest_success_task_id: Math.max(0, Number(source.latest_success_task_id) || 0),
  }
}

function monitoringConfigurationMeta(value) {
  return CONFIGURATION_META[normalizeMonitoringConfiguration(value).state]
}

function normalizeMonitoringHealth(value) {
  const source = asObject(value)
  const state = Object.prototype.hasOwnProperty.call(HEALTH_META, String(source.state || ''))
    ? String(source.state)
    : 'unknown'
  const meta = HEALTH_META[state]
  return {
    ...source,
    state,
    label: meta.label,
    severity: meta.status,
    summary: displaySystemText(source.summary || meta.summary),
    reasons: normalizedReasons(source.reasons),
    configuration: normalizeMonitoringConfiguration(source.configuration),
    enabled_item_count: Math.max(0, Number(source.enabled_item_count) || 0),
    supported_item_count: Math.max(0, Number(source.supported_item_count) || 0),
    fresh_item_count: Math.max(0, Number(source.fresh_item_count) || 0),
    stale_item_count: Math.max(0, Number(source.stale_item_count) || 0),
    unsupported_item_count: Math.max(0, Number(source.unsupported_item_count) || 0),
    no_data_item_count: Math.max(0, Number(source.no_data_item_count) || 0),
  }
}

function monitoringHealthMeta(value) {
  return HEALTH_META[normalizeMonitoringHealth(value).state]
}

function monitoringReasonLabel(reason) {
  const value = String(reason || '').trim()
  if (!value) return ''
  if (REASON_LABELS[value]) return REASON_LABELS[value]
  const prefixes = {
    item_clock_in_future: '监控值时间超前',
    required_item_missing_or_disabled: '必需监控项缺失或已停用',
    required_item_stale: '必需监控项数据已过期',
    required_item_unsupported: '必需监控项不受支持',
    required_macro_missing: '必需宏缺失',
    required_template_missing: '必需模板缺失',
    unknown_item_type: '遇到未知的监控中心监控项类型',
  }
  const separator = value.indexOf(':')
  const prefix = separator >= 0 ? value.slice(0, separator) : value
  const detail = separator >= 0 ? value.slice(separator + 1) : ''
  if (prefixes[prefix]) return detail ? `${prefixes[prefix]}：${detail}` : prefixes[prefix]
  if (/_item_interface_id_missing$/.test(value)) return '监控项缺少监控中心接口 ID'
  if (/_item_interface_missing$/.test(value)) return '监控项引用的监控中心接口不存在'
  if (/_item_interface_type_mismatch$/.test(value)) return '监控项引用的监控中心接口类型不匹配'
  if (/_interface_availability_unknown$/.test(value)) return '采集接口可用性尚无证据'
  if (/_interface_(error|missing|unavailable)$/.test(value)) return '采集接口存在异常或缺失'
  return value
}

function monitoringReasonLabels(value) {
  return normalizeMonitoringHealth(value).reasons.map(monitoringReasonLabel).filter(Boolean)
}

function interfaceAvailabilityLabel(value) {
  if (String(value) === '1') return '接口可用'
  if (String(value) === '2') return '接口不可用'
  return '接口状态未知'
}

module.exports = {
  CONFIGURATION_META,
  HEALTH_META,
  interfaceAvailabilityLabel,
  monitoringConfigurationMeta,
  monitoringHealthMeta,
  monitoringReasonLabel,
  monitoringReasonLabels,
  normalizeMonitoringConfiguration,
  normalizeMonitoringHealth,
}
