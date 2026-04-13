// @ts-nocheck
import { IWalkthroughsService, getService } from '@codingame/monaco-vscode-api'
import { ContextKeyExpr } from '@codingame/monaco-vscode-api/monaco'
import { ExtensionHostKind, registerExtension } from '@codingame/monaco-vscode-api/extensions'
import * as monaco from 'monaco-editor'
import * as vscode from 'vscode'
import { workspaceRoot as workbenchWorkspaceRoot } from '../setup.common'
import { createBridgeConnectionContext } from './bridgeConnection'
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

  const disposables: Array<{ dispose?: () => void }> = [
    ...extensionDisposables,
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
