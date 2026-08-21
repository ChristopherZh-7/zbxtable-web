import { TENANT, TENANT_CONTEXT, TENANT_CURRENT, TENANT_CURRENT_MEMBERS } from '@/services/api'
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

export function listCurrentTenantMembers() {
  return request(TENANT_CURRENT_MEMBERS, METHOD.GET)
}

export function addCurrentTenantMember(payload) {
  return request(TENANT_CURRENT_MEMBERS, METHOD.POST, payload)
}

export function updateCurrentTenantMemberRole(id, role) {
  return request(`${TENANT_CURRENT_MEMBERS}/${id}`, METHOD.PUT, {role})
}

export function deleteCurrentTenantMember(id) {
  return request(`${TENANT_CURRENT_MEMBERS}/${id}`, METHOD.DELETE)
}
