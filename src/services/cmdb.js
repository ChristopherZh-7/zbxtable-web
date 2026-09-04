import { CMDB, CMDB_ADMIN } from '@/services/api'
import { METHOD, request } from '@/utils/request'

const tenantHeaderName = 'X-Tenant-ID'
const cmdbOrganizationHeaderName = 'X-CMDB-Organization-ID'
const cmdbGenerationHeaderName = 'X-CMDB-Mapping-Generation'

function tenantRequestConfig(tenantID) {
  return {headers: {[tenantHeaderName]: String(Number(tenantID) || '')}}
}

function cmdbWriteConfig(context) {
  const source = context || {}
  return {
    headers: {
      [cmdbOrganizationHeaderName]: String(Number(source.organization_id) || ''),
      [cmdbGenerationHeaderName]: String(Number(source.generation) || ''),
    },
  }
}

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

export function getMonitoringProvisionResources() {
  return request(`${CMDB}/monitoring-provisions/resources`, METHOD.GET)
}

export function listMonitoringProvisions(assetClass, id) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring/provisions`, METHOD.GET)
}

export function createMonitoringProvision(assetClass, id, payload, context) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring/provisions`, METHOD.POST, payload, cmdbWriteConfig(context))
}

export function retryMonitoringProvision(assetClass, id, provisionID, expectedVersion, context) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring/provisions/${encodeURIComponent(provisionID)}/retry`, METHOD.POST, {expected_version: Number(expectedVersion)}, cmdbWriteConfig(context))
}

export function listCMDBMonitoringCandidates(assetClass, id, params) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring/candidates`, METHOD.GET, params)
}

export function bindCMDBMonitoring(assetClass, id, zid, hostID, context) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring`, METHOD.PUT, {
    zid: Number(zid),
    host_id: String(hostID),
  }, cmdbWriteConfig(context))
}

export function unbindCMDBMonitoring(assetClass, id, context) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring/unbind`, METHOD.POST, {}, cmdbWriteConfig(context))
}

export function repairCMDBMonitoring(assetClass, id, context) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/monitoring/repair`, METHOD.POST, {}, cmdbWriteConfig(context))
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

export function createCMDBTeam(fields, context) {
  return request(`${CMDB}/responsibilities/teams`, METHOD.POST, {fields}, cmdbWriteConfig(context))
}

export function updateCMDBTeam(id, expectedRevision, fields, context) {
  return request(`${CMDB}/responsibilities/teams/${encodeURIComponent(id)}`, METHOD.PUT, {
    expected_revision: expectedRevision,
    fields,
  }, cmdbWriteConfig(context))
}

export function transitionCMDBTeam(id, expectedRevision, activate, context) {
  const action = activate ? 'activate' : 'deactivate'
  return request(`${CMDB}/responsibilities/teams/${encodeURIComponent(id)}/${action}`, METHOD.POST, {
    expected_revision: expectedRevision,
  }, cmdbWriteConfig(context))
}

export function createCMDBPerson(fields, context) {
  return request(`${CMDB}/responsibilities/people`, METHOD.POST, {fields}, cmdbWriteConfig(context))
}

export function updateCMDBPerson(id, expectedRevision, fields, context) {
  return request(`${CMDB}/responsibilities/people/${encodeURIComponent(id)}`, METHOD.PUT, {
    expected_revision: expectedRevision,
    fields,
  }, cmdbWriteConfig(context))
}

export function transitionCMDBPerson(id, expectedRevision, activate, context) {
  const action = activate ? 'activate' : 'deactivate'
  return request(`${CMDB}/responsibilities/people/${encodeURIComponent(id)}/${action}`, METHOD.POST, {
    expected_revision: expectedRevision,
  }, cmdbWriteConfig(context))
}

export function updateCMDBPersonTeams(id, expectedRevision, teamIDs, context) {
  return request(`${CMDB}/responsibilities/people/${encodeURIComponent(id)}/teams`, METHOD.PUT, {
    expected_revision: expectedRevision,
    team_ids: (teamIDs || []).map(Number),
  }, cmdbWriteConfig(context))
}

export function setCMDBPersonAccount(id, userID, context) {
  return request(`${CMDB}/responsibilities/people/${encodeURIComponent(id)}/account`, METHOD.PUT, {
    user_id: Number(userID) || 0,
  }, cmdbWriteConfig(context))
}

export function listCMDBAdmissions(params) {
  return request(`${CMDB}/admissions`, METHOD.GET, params)
}

export function admitCMDBCandidate(payload, context) {
  return request(`${CMDB}/admissions`, METHOD.POST, payload, cmdbWriteConfig(context))
}

export function retryCMDBAdmission(zid, hostID, context) {
  return request(`${CMDB}/admissions/${encodeURIComponent(zid)}/${encodeURIComponent(hostID)}/retry`, METHOD.POST, {}, cmdbWriteConfig(context))
}

export function createCMDBAsset(assetClass, fields, context) {
  return request(`${CMDB}/assets`, METHOD.POST, {class: assetClass, fields}, cmdbWriteConfig(context))
}

export function updateCMDBAsset(assetClass, id, expectedRevision, fields, context) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}`, METHOD.PUT, {
    expected_revision: expectedRevision,
    fields,
  }, cmdbWriteConfig(context))
}

export function retireCMDBAsset(assetClass, id, expectedRevision, context) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/retire`, METHOD.POST, {
    expected_revision: expectedRevision,
  }, cmdbWriteConfig(context))
}

export function activateCMDBAsset(assetClass, id, expectedRevision, context) {
  return request(`${CMDB}/assets/${encodeURIComponent(assetClass)}/${encodeURIComponent(id)}/activate`, METHOD.POST, {
    expected_revision: expectedRevision,
  }, cmdbWriteConfig(context))
}

export function listCMDBOrganizations() {
  return request(`${CMDB_ADMIN}/organizations`, METHOD.GET)
}

export function listCMDBMappings(tenantID) {
  return request(`${CMDB_ADMIN}/mappings`, METHOD.GET, undefined, tenantRequestConfig(tenantID))
}

export function upsertCMDBMapping(tenantID, organizationID) {
  return request(`${CMDB_ADMIN}/mappings/${encodeURIComponent(tenantID)}`, METHOD.PUT, {
    itop_organization_id: Number(organizationID),
  }, tenantRequestConfig(tenantID))
}

export function previewCMDBMappingTransition(tenantID, payload) {
  return request(`${CMDB_ADMIN}/mappings/${encodeURIComponent(tenantID)}/transitions/preview`, METHOD.POST, payload, tenantRequestConfig(tenantID))
}

export function executeCMDBMappingTransition(tenantID, payload) {
  return request(`${CMDB_ADMIN}/mappings/${encodeURIComponent(tenantID)}/transitions`, METHOD.POST, payload, tenantRequestConfig(tenantID))
}
