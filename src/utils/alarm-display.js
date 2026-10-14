// Display-only translations of known Zabbix template messages. Never change
// source events, trigger matching, host/path identifiers or numeric thresholds.
const RULES = [
  [/Number of installed packages has been changed$/i, () => '已安装的软件包数量发生变化'],
  [/Running out of free inodes \(free\s*([<>]=?\s*[^)]+)\)$/i, match => `可用 inode 不足（剩余 ${match[1]}）`],
  [/Space is critically low \(used\s*([<>]=?\s*[^,]+),\s*total\s+([^)]+)\)$/i, match => `磁盘空间严重不足（已用 ${match[1]}，总量 ${match[2]}）`],
  [/Space is low \(used\s*([<>]=?\s*[^,]+),\s*total\s+([^)]+)\)$/i, match => `磁盘空间不足（已用 ${match[1]}，总量 ${match[2]}）`],
  [/High CPU utilization(?: \(([^)]+)\))?$/i, match => 'CPU 使用率过高' + condition(match[1])],
  [/High memory utilization(?: \(([^)]+)\))?$/i, match => '内存使用率过高' + condition(match[1])],
  [/Lack of available memory(?: \(([^)]+)\))?$/i, match => '可用内存不足' + condition(match[1])],
  [/Lack of free swap space(?: \(([^)]+)\))?$/i, match => '可用交换空间不足' + condition(match[1])],
  [/Host has been restarted(?: \(([^)]+)\))?$/i, match => '主机已重启' + condition(match[1])],
  [/Unavailable by ICMP ping$/i, () => 'ICMP Ping 不可达'],
  [/Zabbix agent is not available(?: \(([^)]+)\))?$/i, match => 'Zabbix Agent 不可用' + condition(match[1])],
  [/System time is out of sync(?: \(([^)]+)\))?$/i, match => '系统时间不同步' + condition(match[1])],
  [/Operating system description has changed$/i, () => '操作系统描述发生变化'],
  [/System name has changed(?: \(new name: ([^)]+)\))?$/i, match => '系统名称发生变化' + (match[1] ? `（新名称：${match[1]}）` : '')],
]

function condition(value) {
  if (!value) return ''
  // Only a matched template's condition is translated, never its path prefix.
  const words = {free: '剩余', used: '已用', total: '总量', uptime: '运行时长', utilization: '使用率', for: '持续', over: '超过', below: '低于'}
  return '（' + value.replace(/(\{[^{}]*\})|\b(free|used|total|uptime|utilization|for|over|below)\b/gi,
    (word, macro) => macro || words[word.toLowerCase()]) + '）'
}

function formatAlarmMessage(value, locale = 'CN') {
  const text = typeof value === 'string' ? value : ''
  if (!/^(CN|HK|zh(?:[-_].*)?)$/i.test(locale)) return text
  for (const [pattern, translate] of RULES) {
    const match = pattern.exec(text)
    // A phrase inside an arbitrary description or filesystem path is not a
    // recognized trigger template. Keep unknown/custom wording verbatim.
    if (match && (match.index === 0 || text.slice(match.index - 2, match.index) === ': ')) {
      return text.slice(0, match.index) + translate(match)
    }
  }
  return text
}

module.exports = {formatAlarmMessage}
