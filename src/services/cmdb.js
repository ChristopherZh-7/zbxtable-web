import { CMDB, CMDB_ADMIN } from '@/services/api'
import { METHOD, request } from '@/utils/request'

export function getCMDBOverview() {
  return request(`${CMDB}/overview`, METHOD.GET)
}

export function listCMDBAssets(params) {
  return request(`${CMDB}/assets`, METHOD.GET, params)
}

export function getCMDBAsset(assetClass, id) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}`, METHOD.GET)
}

export function getCMDBRelations(assetClass, id) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/relations`, METHOD.GET)
}

export function listCMDBOrganizations() {
  return request(`${CMDB_ADMIN}/organizations`, METHOD.GET)
}

export function listCMDBMappings() {
  return request(`${CMDB_ADMIN}/mappings`, METHOD.GET)
}

export function upsertCMDBMapping(tenantID, organizationID) {
  return request(`${CMDB_ADMIN}/mappings/${encodeURIComponent(tenantID)}`, METHOD.PUT, {
    itop_organization_id: Number(organizationID),
  })
}
