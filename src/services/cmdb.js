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

export function getCMDBReferences() {
  return request(`${CMDB}/references`, METHOD.GET)
}

export function createCMDBAsset(assetClass, fields) {
  return request(`${CMDB}/assets`, METHOD.POST, {class: assetClass, fields})
}

export function updateCMDBAsset(assetClass, id, expectedRevision, fields) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}`, METHOD.PUT, {
    expected_revision: expectedRevision,
    fields,
  })
}

export function retireCMDBAsset(assetClass, id, expectedRevision) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/retire`, METHOD.POST, {
    expected_revision: expectedRevision,
  })
}

export function activateCMDBAsset(assetClass, id, expectedRevision) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/activate`, METHOD.POST, {
    expected_revision: expectedRevision,
  })
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
