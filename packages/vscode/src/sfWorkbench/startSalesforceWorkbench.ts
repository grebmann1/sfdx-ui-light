// @ts-nocheck
import { IWalkthroughsService, getService } from '@codingame/monaco-vscode-api'
import { ContextKeyExpr } from '@codingame/monaco-vscode-api/monaco'
import { ExtensionHostKind, registerExtension } from '@codingame/monaco-vscode-api/extensions'
import * as monaco from 'monaco-editor'
import * as vscode from 'vscode'
import { workspaceRoot as workbenchWorkspaceRoot } from '../setup.common'
import { createBridgeConnectionContext } from './bridgeConnection'
import { DARK_COLOR_THEME, LIGHT_COLOR_THEME } from './fullApp/constants'
import { shareCurrentConnectionContext, clearSharedCurrentConnectionContext } from './fullApp/workbench/connection/currentConnection'
import { buildOrgContext } from './fullApp/workbench/connection/orgContext'
import { createCoreServices } from './fullApp/extensions/core/coreServices'
import { registerAllExtensions } from './fullApp/workbench/orchestration/extensionRegistry'

type RuntimeHandle = {
  dispose: () => void
}

let runtimeHandle: RuntimeHandle | null = null

function disposeDisposables(disposables: Array<{ dispose?: () => void }>) {
  for (const disposable of disposables.reverse()) {
    try {
      disposable?.dispose?.()
    } catch {
      // ignore
    }
  }
}

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function asLowerString(value: unknown) {
  return asString(value).toLowerCase()
}

async function applyWorkbenchThemeMode(themeMode: 'light' | 'dark') {
  const targetTheme = themeMode === 'dark' ? DARK_COLOR_THEME : LIGHT_COLOR_THEME
  const workbenchConfig = vscode.workspace?.getConfiguration?.('workbench')
  if (typeof workbenchConfig?.update !== 'function') {
    return
  }
  try {
    await workbenchConfig.update('colorTheme', targetTheme, true)
  } catch {
    try {
      await workbenchConfig.update('colorTheme', targetTheme)
    } catch {
      // ignore
    }
  }
}

export async function startSalesforceWorkbench() {
  if (runtimeHandle != null) {
    return runtimeHandle
  }

  const vscodeBundle = {
    monaco,
    vscode,
    vscodeApi: { getService, IWalkthroughsService },
    vscodeApiMonaco: { ContextKeyExpr },
    extensions: { registerExtension, ExtensionHostKind }
  }

  const bridgeConnection = await createBridgeConnectionContext({
    workspaceRoot: workbenchWorkspaceRoot
  })

  await bridgeConnection.refreshStatus()

  const provider = () => bridgeConnection.getContext()
  shareCurrentConnectionContext(provider)

  const connectionContext = provider()
  const orgContext = buildOrgContext(
    ((connectionContext.connection ?? {}) as Record<string, unknown>) || {}
  )
  const coreServices = await createCoreServices(vscodeBundle as any)
  const extensionDisposables = await registerAllExtensions(vscodeBundle as any, {
    coreServices,
    orgContext
  })

  const refreshRuntimeStatus = () => {
    const runtime = (coreServices?.connection?.runtime as Record<string, unknown>) || null
    if (!runtime) {
      return
    }
    const loadStoredConn = runtime.loadStoredConn
    const setStatus = runtime.setStatus
    if (typeof loadStoredConn !== 'function' || typeof setStatus !== 'function') {
      return
    }
    try {
      setStatus(loadStoredConn())
    } catch {
      // ignore
    }
  }

  const refreshSchemaCacheFromHostEvent = async () => {
    const schemaTools = (coreServices?.operations?.schemaTools as Record<string, unknown>) || null
    const runtime = (coreServices?.connection?.runtime as Record<string, unknown>) || null
    const ensureGlobalDescribe = schemaTools?.ensureGlobalDescribe
    const loadStoredConn = runtime?.loadStoredConn
    if (typeof ensureGlobalDescribe !== 'function' || typeof loadStoredConn !== 'function') {
      return
    }
    try {
      await ensureGlobalDescribe(loadStoredConn(), { force: true })
      refreshRuntimeStatus()
    } catch {
      // ignore
    }
  }

  const handleBridgeHostEvent = async (event: {
    eventName?: unknown
    payload?: Record<string, unknown> | null
  }) => {
    const eventName = asLowerString(event?.eventName)
    const payload =
      event?.payload && typeof event.payload === 'object'
        ? (event.payload as Record<string, unknown>)
        : null

    if (eventName === 'connection.state') {
      refreshRuntimeStatus()
      return
    }

    if (eventName === 'theme.mode' && payload) {
      const themeMode = asLowerString(payload.themeMode)
      if (themeMode === 'dark' || themeMode === 'light') {
        await applyWorkbenchThemeMode(themeMode)
      }
      return
    }

    if (eventName !== 'banner.action' || !payload) {
      return
    }

    const action = asLowerString(payload.action)
    const status = asLowerString(payload.status)

    if (
      (action === 'reconnectmanually' || action === 'importbrowserorg') &&
      (status === 'completed' || status === 'failed' || status === 'cancelled')
    ) {
      await bridgeConnection.refreshStatus()
      refreshRuntimeStatus()
      return
    }

    if (action === 'refreshsalesforcemetadata' && status === 'completed') {
      await refreshSchemaCacheFromHostEvent()
    }
  }

  const bridgeHostEventDisposable = bridgeConnection.onHostEvent(event => {
    void handleBridgeHostEvent(event)
  })

  const disposables: Array<{ dispose?: () => void }> = [
    ...extensionDisposables,
    bridgeHostEventDisposable,
    {
      dispose() {
        clearSharedCurrentConnectionContext(provider)
      }
    },
    {
      dispose() {
        bridgeConnection.dispose()
      }
    }
  ]

  runtimeHandle = {
    dispose() {
      if (runtimeHandle == null) {
        return
      }
      runtimeHandle = null
      disposeDisposables(disposables)
    }
  }

  window.addEventListener(
    'beforeunload',
    () => {
      runtimeHandle?.dispose()
    },
    { once: true }
  )

  return runtimeHandle
}
