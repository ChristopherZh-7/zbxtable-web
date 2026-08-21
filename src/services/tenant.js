import { TENANT, TENANT_CONTEXT, TENANT_CURRENT } from '@/services/api'
import { METHOD, request } from '@/utils/request'

export function listTenantContexts() {
  return request(TENANT_CONTEXT, METHOD.GET)
}

export function getCurrentTenant() {
  return request(TENANT_CURRENT, METHOD.GET)
}

export function listTenants() {
  return request(TENANT, METHOD.GET)
}

export function createTenant(payload) {
  return request(TENANT, METHOD.POST, payload)
}

export function updateTenant(id, payload) {
  return request(`${TENANT}/${id}`, METHOD.PUT, payload)
}

export function updateTenantStatus(id, status) {
  return request(`${TENANT}/status/${id}`, METHOD.PUT, { status })
}

export function listTenantResources(zid) {
  return request(`${TENANT}/resources`, METHOD.GET, { zid })
}
