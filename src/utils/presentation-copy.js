// Apply only to human-readable display messages, never IDs, URLs or payloads.
function displaySystemText(value) {
  const text = value == null ? '' : String(value)
  const labels = {Zabbix: '监控中心', iTop: '配置管理中心', SmartOps: '平台'}
  return text.replace(/(^|[^A-Za-z0-9_:/.-])(Zabbix|iTop|SmartOps)(?=$|[^A-Za-z0-9_:/.-])/g,
    (match, prefix, name) => prefix + labels[name])
}

module.exports = {displaySystemText}
