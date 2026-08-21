import { METHOD, request } from '@/utils/request'

export function listAuditLogs(params) {
  return request('/v1/audit', METHOD.GET, params)
}
