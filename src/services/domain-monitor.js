import {request, METHOD} from '@/utils/request'
const base = '/v1/domain-monitor'
export const listDomains = () => request(base, METHOD.GET)
export const saveDomain = (id, body) => request(id ? base + '/' + id : base, id ? METHOD.PUT : METHOD.POST, body)
export const syncDomain = row => request(base + '/' + row.id + '/sync', METHOD.POST, {revision: row.revision})
export const removeDomain = row => request(base + '/' + row.id + '?revision=' + row.revision, METHOD.DELETE)
export const domainHistory = id => request(base + '/' + id + '/history', METHOD.GET)
