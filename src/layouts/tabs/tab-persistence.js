const TAB_CACHE_VERSION = 1

function normalizeTab(tab) {
  if (!tab || typeof tab !== 'object' || typeof tab.path !== 'string' || !tab.path.startsWith('/')) {
    return null
  }

  return {
    keyPath: typeof tab.keyPath === 'string' ? tab.keyPath : tab.path,
    fullPath: typeof tab.fullPath === 'string' ? tab.fullPath : tab.path,
    path: tab.path,
    title: typeof tab.title === 'string' ? tab.title : undefined,
    unclose: tab.unclose === true,
    loading: false,
    _init_: false,
  }
}

function normalizeTabs(tabs) {
  if (!Array.isArray(tabs)) {
    return []
  }

  const seen = new Set()
  return tabs.reduce((result, tab) => {
    const normalized = normalizeTab(tab)
    if (!normalized || seen.has(normalized.path)) {
      return result
    }
    seen.add(normalized.path)
    result.push(normalized)
    return result
  }, [])
}

function serializeTabs(tabs) {
  return JSON.stringify({
    version: TAB_CACHE_VERSION,
    tabs: normalizeTabs(tabs),
  })
}

function deserializeTabs(raw) {
  if (!raw) {
    return []
  }
  const parsed = JSON.parse(raw)
  // 兼容 F01 前仅保存数组的旧格式。
  if (Array.isArray(parsed)) {
    return normalizeTabs(parsed)
  }
  if (!parsed || parsed.version !== TAB_CACHE_VERSION) {
    return []
  }
  return normalizeTabs(parsed.tabs)
}

function saveTabs(storage, key, tabs) {
  if (!storage || !key) {
    return
  }
  storage.setItem(key, serializeTabs(tabs))
}

function loadTabs(storage, key) {
  if (!storage || !key) {
    return []
  }
  try {
    return deserializeTabs(storage.getItem(key))
  } catch (error) {
    storage.removeItem(key)
    return []
  }
}

function clearTabs(storage, key) {
  if (storage && key) {
    storage.removeItem(key)
  }
}

module.exports = {
  TAB_CACHE_VERSION,
  clearTabs,
  deserializeTabs,
  loadTabs,
  normalizeTabs,
  saveTabs,
  serializeTabs,
}
