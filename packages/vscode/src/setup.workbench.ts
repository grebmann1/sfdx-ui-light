// @ts-nocheck
import {
  IStorageService,
  getService,
  initialize as initializeMonacoService
} from '@codingame/monaco-vscode-api'
import getWorkbenchServiceOverride from '@codingame/monaco-vscode-workbench-service-override'
import getQuickAccessServiceOverride from '@codingame/monaco-vscode-quickaccess-service-override'
import { BrowserStorageService } from '@codingame/monaco-vscode-storage-service-override'
import { ExtensionHostKind } from '@codingame/monaco-vscode-extensions-service-override'
import { registerExtension } from '@codingame/monaco-vscode-api/extensions'
import {
  commonServices,
  constructOptions,
  envOptions,
  userDataProvider
} from './setup.common'
import { startSalesforceWorkbench } from './workbench/startSalesforceWorkbench'

const container = document.createElement('div')
container.style.height = '100vh'
document.body.replaceChildren(container)

const shadowRoot = container.attachShadow({ mode: 'open' })
const workbenchElement = document.createElement('div')
workbenchElement.style.height = '100vh'
shadowRoot.appendChild(workbenchElement)

const workbenchOverrideStyle = document.createElement('style')
workbenchOverrideStyle.textContent = `
  .monaco-workbench .statusbar {
    height: 18px !important;
    line-height: 18px !important;
    font-size: 11px !important;
  }
  .monaco-workbench .statusbar .statusbar-item {
    line-height: 18px !important;
  }
  .monaco-workbench .statusbar .statusbar-item .label,
  .monaco-workbench .statusbar .statusbar-item a {
    font-size: 11px !important;
    line-height: 18px !important;
  }
`
shadowRoot.appendChild(workbenchOverrideStyle)

await initializeMonacoService(
  {
    ...commonServices,
    ...getWorkbenchServiceOverride(),
    ...getQuickAccessServiceOverride({
      isKeybindingConfigurationVisible: () => true,
      shouldUseGlobalPicker: () => true
    })
  },
  workbenchElement,
  constructOptions,
  envOptions
)

export async function clearStorage(): Promise<void> {
  await userDataProvider.reset()
  await ((await getService(IStorageService)) as BrowserStorageService).clear()
}

await registerExtension(
  {
    name: 'sf-workbench',
    publisher: 'salesforce',
    version: '1.0.0',
    engines: {
      vscode: '*'
    }
  },
  ExtensionHostKind.LocalProcess
).setAsDefaultApi()

await startSalesforceWorkbench()
