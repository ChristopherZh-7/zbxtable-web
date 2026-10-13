function normalizeTenantItems(response) {
  const business = response && response.data && response.data.code !== undefined ? response.data : response
  const items = business && business.data && business.data.items
  return Array.isArray(items) ? items.filter((item) => item && Number(item.status) === 0) : []
}

function selectInitialTenant(tenants, storedTenant, allowAutoSelect = true) {
  const items = Array.isArray(tenants) ? tenants : []
  const storedID = storedTenant && Number(storedTenant.id)
  if (storedID) {
    const matched = items.find((tenant) => Number(tenant.id) === storedID)
    if (matched) return matched
  }
  return allowAutoSelect && items.length === 1 ? items[0] : null
}

function validateTenantDraft(draft) {
  if (!draft || !/^[A-Za-z][A-Za-z0-9_-]{2,63}$/.test(String(draft.code || '').trim())) {
    return '租户编码须以字母开头，使用 3–64 位字母、数字、下划线或连字符'
  }
  if (!String(draft.name || '').trim()) return '租户名称不能为空'
  const scopes = Array.isArray(draft.scopes) ? draft.scopes : []
  if (scopes.some((scope) => !Number(scope.zid) || !String(scope.host_group_id || '').trim())) {
    return '每个资源范围都必须选择监控源和主机组'
  }
  return ''
}

function buildTenantPayload(draft, editing) {
  const payload = {
    name: String(draft.name || '').trim(),
    member_ids: (draft.member_ids || []).map(Number),
    scopes: (draft.scopes || []).map((scope) => ({
      zid: Number(scope.zid),
      host_group_id: String(scope.host_group_id || '').trim(),
      host_group_name: String(scope.host_group_name || '').trim(),
    })),
  }
  if (!editing) payload.code = String(draft.code || '').trim()
  return payload
}

module.exports = {
  buildTenantPayload,
  normalizeTenantItems,
  selectInitialTenant,
  validateTenantDraft,
}
