export function guid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `workbench-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function isChromeExtension() {
  const runtime = (globalThis as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime
  return Boolean(runtime?.id)
}
