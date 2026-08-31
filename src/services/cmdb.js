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

export function getCMDBMonitoring(assetClass, id) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring`, METHOD.GET)
}

export function listCMDBMonitoringCandidates(assetClass, id, params) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring/candidates`, METHOD.GET, params)
}

export function bindCMDBMonitoring(assetClass, id, zid, hostID) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring`, METHOD.PUT, {
    zid: Number(zid),
    host_id: String(hostID),
  })
}

export function unbindCMDBMonitoring(assetClass, id) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring/unbind`, METHOD.POST, {})
}

export function repairCMDBMonitoring(assetClass, id) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring/repair`, METHOD.POST, {})
}

export function getCMDBReferences() {
  return request(`${CMDB}/references`, METHOD.GET)
}

export function getCMDBResponsibilities() {
  return request(`${CMDB}/responsibilities`, METHOD.GET)
}

export function listCMDBResponsibilityAccountOptions() {
  return request(`${CMDB}/responsibilities/account-options`, METHOD.GET)
}

export function createCMDBTeam(fields) {
  return request(`${CMDB}/responsibilities/teams`, METHOD.POST, {fields})
}

export function updateCMDBTeam(id, expectedRevision, fields) {
  return request(`${CMDB}/responsibilities/teams/${encodeURIComponent(id)}`, METHOD.PUT, {
    expected_revision: expectedRevision,
    fields,
  })
}

export function transitionCMDBTeam(id, expectedRevision, activate) {
  const action = activate ? 'activate' : 'deactivate'
  return request(`${CMDB}/responsibilities/teams/${encodeURIComponent(id)}/${action}`, METHOD.POST, {
    expected_revision: expectedRevision,
  })
}

export function createCMDBPerson(fields) {
  return request(`${CMDB}/responsibilities/people`, METHOD.POST, {fields})
}

export function updateCMDBPerson(id, expectedRevision, fields) {
  return request(`${CMDB}/responsibilities/people/${encodeURIComponent(id)}`, METHOD.PUT, {
    expected_revision: expectedRevision,
    fields,
  })
}

export function transitionCMDBPerson(id, expectedRevision, activate) {
  const action = activate ? 'activate' : 'deactivate'
  return request(`${CMDB}/responsibilities/people/${encodeURIComponent(id)}/${action}`, METHOD.POST, {
    expected_revision: expectedRevision,
  })
}

export function updateCMDBPersonTeams(id, expectedRevision, teamIDs) {
  return request(`${CMDB}/responsibilities/people/${encodeURIComponent(id)}/teams`, METHOD.PUT, {
    expected_revision: expectedRevision,
    team_ids: (teamIDs || []).map(Number),
  })
}

export function setCMDBPersonAccount(id, userID) {
  return request(`${CMDB}/responsibilities/people/${encodeURIComponent(id)}/account`, METHOD.PUT, {
    user_id: Number(userID) || 0,
  })
}

export function listCMDBAdmissions(params) {
  return request(`${CMDB}/admissions`, METHOD.GET, params)
}

export function admitCMDBCandidate(payload) {
  return request(`${CMDB}/admissions`, METHOD.POST, payload)
}

export function retryCMDBAdmission(zid, hostID) {
  return request(`${CMDB}/admissions/${encodeURIComponent(zid)}/${encodeURIComponent(hostID)}/retry`, METHOD.POST, {})
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
