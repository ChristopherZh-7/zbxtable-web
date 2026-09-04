const CONTACT_STATUS = {
  active: {label: '启用', color: 'green', tone: 'active'},
  inactive: {label: '停用', color: 'default', tone: 'inactive'},
}

const ACCOUNT_STATE = {
  available: {label: '可用账号', color: 'green', tone: 'available'},
  disabled: {label: '账号已停用', color: 'red', tone: 'warning'},
  not_member: {label: '已移出租户', color: 'orange', tone: 'warning'},
  deleted: {label: '账号已删除', color: 'red', tone: 'warning'},
  unlinked: {label: '外部人员 / 未关联', color: 'default', tone: 'unlinked'},
}

function normalizeImpact(impact) {
  const source = impact || {}
  return {
    total: Math.max(0, Number(source.total) || 0),
    operations_team: Math.max(0, Number(source.operations_team) || 0),
    primary_owner: Math.max(0, Number(source.primary_owner) || 0),
    backup_owner: Math.max(0, Number(source.backup_owner) || 0),
    sample_assets: Array.isArray(source.sample_assets) ? source.sample_assets : [],
  }
}

function normalizeContact(contact, type) {
  const source = contact || {}
  return {
    ...source,
    id: Number(source.id) || 0,
    class: type === 'team' ? 'Team' : 'Person',
    display_name: String(source.display_name || source.name || '').trim(),
    name: String(source.name || '').trim(),
    first_name: String(source.first_name || '').trim(),
    status: CONTACT_STATUS[source.status] ? source.status : 'inactive',
    team_ids: Array.isArray(source.team_ids) ? source.team_ids.map(Number).filter(Boolean) : [],
    person_ids: Array.isArray(source.person_ids) ? source.person_ids.map(Number).filter(Boolean) : [],
    impact: normalizeImpact(source.impact),
    account: source.account && Number(source.account.user_id) > 0 ? {
      ...source.account,
      user_id: Number(source.account.user_id),
      state: ACCOUNT_STATE[source.account.state] ? source.account.state : 'deleted',
    } : null,
  }
}

function normalizeDirectory(data) {
  const source = data || {}
  const state = source.state === 'ready' || source.state === 'error' ? source.state : 'unconfigured'
  return {
    state,
    message: String(source.message || ''),
    organization: source.organization || null,
    mapping: source.mapping || null,
    teams: Array.isArray(source.teams) ? source.teams.map(item => normalizeContact(item, 'team')) : [],
    people: Array.isArray(source.people) ? source.people.map(item => normalizeContact(item, 'person')) : [],
  }
}

function contactStatusMeta(status) {
  return CONTACT_STATUS[status] || CONTACT_STATUS.inactive
}

function accountStateMeta(account) {
  return ACCOUNT_STATE[account && account.state || 'unlinked'] || ACCOUNT_STATE.unlinked
}

function impactLabel(contact) {
  const impact = normalizeImpact(contact && contact.impact)
  if (!impact.total) return '暂无资产引用'
  if (contact && contact.class === 'Team') return `${impact.total} 项资产的运维团队`
  const parts = []
  if (impact.primary_owner) parts.push(`主责 ${impact.primary_owner}`)
  if (impact.backup_owner) parts.push(`备责 ${impact.backup_owner}`)
  return `${impact.total} 项资产${parts.length ? ` · ${parts.join(' / ')}` : ''}`
}

function filterContacts(items, search, status) {
  const keyword = String(search || '').trim().toLowerCase()
  return (items || []).filter((item) => {
    if (status && item.status !== status) return false
    if (!keyword) return true
    const account = item.account || {}
    return [item.display_name, item.name, item.first_name, item.function, item.email, item.phone, item.mobile_phone, item.employee_number, account.username]
      .some(value => String(value || '').toLowerCase().includes(keyword))
  })
}

function createResponsibilityForm(type, contact) {
  const source = contact || {}
  return {
    name: String(source.name || ''),
    first_name: String(source.first_name || ''),
    email: String(source.email || ''),
    phone: String(source.phone || ''),
    mobile_phone: String(source.mobile_phone || ''),
    notify: source.notify === 'no' ? 'no' : 'yes',
    function: String(source.function || ''),
    employee_number: String(source.employee_number || ''),
    team_ids: type === 'person' && Array.isArray(source.team_ids) ? [...source.team_ids] : [],
    user_id: type === 'person' && source.account ? Number(source.account.user_id) || undefined : undefined,
  }
}

function validateResponsibilityForm(type, form) {
  if (!String(form && form.name || '').trim()) return type === 'team' ? '请输入团队名称' : '请输入负责人姓名'
  if (type === 'person' && !String(form && form.first_name || '').trim()) return '请输入负责人的名 / 英文名'
  const email = String(form && form.email || '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '请输入有效邮箱'
  return ''
}

function buildResponsibilityFields(type, form) {
  const fields = {
    name: String(form && form.name || '').trim(),
    email: String(form && form.email || '').trim(),
    phone: String(form && form.phone || '').trim(),
    notify: form && form.notify === 'no' ? 'no' : 'yes',
    function: String(form && form.function || '').trim(),
  }
  if (type === 'person') {
    fields.first_name = String(form && form.first_name || '').trim()
    fields.employee_number = String(form && form.employee_number || '').trim()
    fields.mobile_phone = String(form && form.mobile_phone || '').trim()
  }
  return fields
}

function deactivateImpactText(contact) {
  const impact = normalizeImpact(contact && contact.impact)
  if (!impact.total) return '当前没有资产引用，可以安全停用。'
  const samples = impact.sample_assets.map(item => item.name).filter(Boolean).slice(0, 5)
  return `仍被 ${impact.total} 项资产引用${samples.length ? `：${samples.join('、')}` : ''}。请先到 CMDB 配置中心重新分配。`
}

module.exports = {
  accountStateMeta,
  buildResponsibilityFields,
  contactStatusMeta,
  createResponsibilityForm,
  deactivateImpactText,
  filterContacts,
  impactLabel,
  normalizeDirectory,
  normalizeImpact,
  validateResponsibilityForm,
}
