const assert = require('node:assert/strict')
const test = require('node:test')
const {formatAlarmMessage} = require('../../src/utils/alarm-display')

test('screenshot Zabbix alerts are Chinese without changing filesystem paths or thresholds', () => {
  const samples = [
    ['Linux: Number of installed packages has been changed', 'Linux: 已安装的软件包数量发生变化'],
    ['Linux: /usr/lib/linux-tools/6.18.54.1-microsoft-standard-WSL2: Running out of free inodes (free < 10%)', 'Linux: /usr/lib/linux-tools/6.18.54.1-microsoft-standard-WSL2: 可用 inode 不足（剩余 < 10%）'],
    ['Linux: FS [/usr/src/linux-headers-6.18.54.1-microsoft-standard-WSL2]: Space is critically low (used > 90%, total 0.1GB)', 'Linux: FS [/usr/src/linux-headers-6.18.54.1-microsoft-standard-WSL2]: 磁盘空间严重不足（已用 > 90%，总量 0.1GB）'],
  ]
  const input = structuredClone(samples)
  for (const [raw, expected] of samples) {
    for (const locale of ['CN', 'zh-CN']) assert.equal(formatAlarmMessage(raw, locale), expected)
    for (const locale of ['US', 'en', 'en-US']) assert.equal(formatAlarmMessage(raw, locale), raw)
  }
  assert.deepEqual(samples, input)
})

test('unknown alerts, Chinese text and template-like paths stay verbatim', () => {
  for (const value of ['业务 A: 数据延迟', 'Custom monitor failed: error 42', '/tmp/Number of installed packages has been changed', 'Prefix Number of installed packages has been changed', '<img src=x onerror=alert(1)>', 'Linux: Running out of free inodes']) {
    assert.equal(formatAlarmMessage(value), value)
  }
  assert.equal(formatAlarmMessage(null), '')
  assert.equal(formatAlarmMessage(undefined), '')
})

test('common templates translate wording while retaining comparison operators and macros', () => {
  assert.equal(formatAlarmMessage('Linux: High CPU utilization (over 90% for 5m)'), 'Linux: CPU 使用率过高（超过 90% 持续 5m）')
  assert.equal(formatAlarmMessage('FS [/data: archive]: Space is low (used >= {$VFS.FS.PUSED.MAX.WARN}, total 1.0TB)'), 'FS [/data: archive]: 磁盘空间不足（已用 >= {$VFS.FS.PUSED.MAX.WARN}，总量 1.0TB）')
  assert.equal(formatAlarmMessage('Host has been restarted (uptime < 10m)'), '主机已重启（运行时长 < 10m）')
  assert.equal(formatAlarmMessage('High CPU utilization (over {$CPU.UTILIZATION} for {$PERIOD.FOR})'), 'CPU 使用率过高（超过 {$CPU.UTILIZATION} 持续 {$PERIOD.FOR}）')
})
