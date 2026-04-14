// @ts-nocheck
import { IWalkthroughsService, getService } from '@codingame/monaco-vscode-api'
import { ContextKeyExpr } from '@codingame/monaco-vscode-api/monaco'
import { ExtensionHostKind, registerExtension } from '@codingame/monaco-vscode-api/extensions'
import * as monaco from 'monaco-editor'
import * as vscode from 'vscode'
import { workspaceRoot as workbenchWorkspaceRoot } from '../setup.common'
import { createBridgeConnectionContext } from './bridge/bridgeConnection'
import { shareCurrentConnectionContext, clearSharedCurrentConnectionContext } from './connection/currentConnection'
import { createCoreServices, setActiveCoreServices } from './extensions/core/coreServices'
import { registerAllExtensions } from './orchestration/extensionRegistry'
import { registerWorkbenchRuntimeEvents } from './orchestration/workbenchLifecycle'

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

  const coreServices = await createCoreServices(vscodeBundle as any)
  setActiveCoreServices(coreServices)

  const extensionDisposables = await registerAllExtensions(vscodeBundle as any, { coreServices })
  const runtimeEventsDisposable = registerWorkbenchRuntimeEvents(bridgeConnection, coreServices)

  const disposables: Array<{ dispose?: () => void }> = [
    ...extensionDisposables,
    runtimeEventsDisposable,
    { dispose() { clearSharedCurrentConnectionContext(provider) } },
    { dispose() { setActiveCoreServices(null) } },
    { dispose() { bridgeConnection.dispose() } }
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
    () => { runtimeHandle?.dispose() },
    { once: true }
  )

  return runtimeHandle
}
