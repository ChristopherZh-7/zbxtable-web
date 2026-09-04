// UI-only list selection. This sentinel is never a CMDB/Inventory type.
const ALL_DEVICE_TYPE = '__all_hosts__'

function monitoringHostTypeFilter(typeCode) {
  return typeCode === ALL_DEVICE_TYPE ? '' : typeCode
}

function allMonitoringDeviceFields() {
  return [
    {key: 'name', label: '设备名称', width: 240},
    {key: 'interfaces', label: '监控地址', width: 160},
    {key: 'instance_name', label: '监控实例', width: 170},
    {key: 'available', label: '采集健康', width: 160},
  ].map((field, order) => ({...field, order, visible: true, render: field.key === 'available' ? 'status' : 'text'}))
}

function unclassifiedMonitoringHosts(assetTypes, dataMap) {
  const known = new Set((assetTypes || []).map(type => type.type_code))
  return Object.entries(dataMap || {})
    .filter(([code]) => !known.has(code))
    .reduce((hosts, [, rows]) => hosts.concat(Array.isArray(rows) ? rows : []), [])
}

module.exports = {ALL_DEVICE_TYPE, monitoringHostTypeFilter, allMonitoringDeviceFields, unclassifiedMonitoringHosts}
