const assert = require('node:assert/strict')
const test = require('node:test')

const {
  clearTabs,
  deserializeTabs,
  loadTabs,
  saveTabs,
} = require('../../src/layouts/tabs/tab-persistence')
const defaultSetting = require('../../src/config/default/setting.config')

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test('operations portal enables multi-page tabs by default', () => {
  assert.equal(defaultSetting.multiPage, true)
})

test('round-trips tabs and removes duplicate routes', () => {
  const storage = memoryStorage()
  saveTabs(storage, 'tabs', [
    {path: '/dashboard/workplace', fullPath: '/dashboard/workplace', keyPath: '/dashboard/workplace', unclose: true},
    {path: '/alarm/list', fullPath: '/alarm/list?range=7d', keyPath: '/alarm/list'},
    {path: '/alarm/list', fullPath: '/alarm/list?range=30d', keyPath: '/alarm/list'},
  ])

  assert.deepEqual(loadTabs(storage, 'tabs'), [
    {
      path: '/dashboard/workplace',
      fullPath: '/dashboard/workplace',
      keyPath: '/dashboard/workplace',
      title: undefined,
      unclose: true,
      loading: false,
      _init_: false,
    },
    {
      path: '/alarm/list',
      fullPath: '/alarm/list?range=7d',
      keyPath: '/alarm/list',
      title: undefined,
      unclose: false,
      loading: false,
      _init_: false,
    },
  ])
})

test('accepts the legacy array format and discards invalid entries', () => {
  const tabs = deserializeTabs(JSON.stringify([
    {path: '/assets/tree'},
    {path: 'not-absolute'},
    null,
  ]))
  assert.equal(tabs.length, 1)
  assert.equal(tabs[0].path, '/assets/tree')
})

test('damaged cache is removed instead of breaking portal startup', () => {
  const storage = memoryStorage()
  storage.setItem('tabs', '{not-json')
  assert.deepEqual(loadTabs(storage, 'tabs'), [])
  assert.equal(storage.getItem('tabs'), null)
})

test('logout can clear the persisted tab set', () => {
  const storage = memoryStorage()
  saveTabs(storage, 'tabs', [{path: '/topology/list'}])
  clearTabs(storage, 'tabs')
  assert.equal(storage.getItem('tabs'), null)
})
