function businessPayload(response) {
  return response && response.data && response.data.code !== undefined ? response.data : response
}

function normalizePermissionContext(response) {
  const business = businessPayload(response)
  const data = business && business.data ? business.data : {}
  return {
    roles: Array.isArray(data.roles) ? data.roles : [],
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    tenantID: Number(data.tenant_id) || null,
  }
}

function normalizeAction(action) {
  if (action === 'add') return 'create'
  if (action === 'edit') return 'update'
  return action
}

function canPerform(permissions, resource, action) {
  const permission = (permissions || []).find((item) => item && item.id === resource)
  const operations = permission && Array.isArray(permission.operation) ? permission.operation : []
  return operations.includes(normalizeAction(action))
}

module.exports = {
  businessPayload,
  canPerform,
  normalizeAction,
  normalizePermissionContext,
}
