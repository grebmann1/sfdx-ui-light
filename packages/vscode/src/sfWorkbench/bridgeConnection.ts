// @ts-nocheck
import { zipSync } from 'fflate'
import { isIframeJsforceBridgeEnabled } from '../../../lwc/app/vscode/tempForIframeContent/bridge/bootstrapIframeJsforceBridge'
import { connectIframeJsforceBridgeClient } from '../../../lwc/app/vscode/tempForIframeContent/bridge/iframeJsforceBridgeClient'
import type { IframeJsforceBridgeHostEvent } from '../../../lwc/app/vscode/tempForIframeContent/bridge/iframeJsforceBridgeContract'

type BridgeClient = {
  dispose?: () => void
  onHostEvent?: (
    listener: (event: IframeJsforceBridgeHostEvent) => void
  ) => { dispose?: () => void }
  getConnectionStatus: () => Promise<any>
  executeSoql: (args: {
    query: string
    mode?: 'standard' | 'tooling' | 'queryAll'
  }) => Promise<any>
  executeAnonymous: (apexCode: string) => Promise<any>
  executeApi: (args: {
    endpoint: string
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    headers?: Record<string, string>
  }) => Promise<any>
  runApexTests: (args: {
    classIds?: string[]
    classNames?: string[]
    pollIntervalMs?: number
    timeoutMs?: number
  }) => Promise<any>
  listMetadataTypes: () => Promise<Array<{ xmlName?: string; inFolder?: boolean }>>
  listMetadata: (args: { type: string; folder?: string }) => Promise<any[]>
  retrieveViaMetadataApi: (args: {
    types: Record<string, string[]>
    timeoutMs?: number
    pollIntervalMs?: number
    includeZip?: boolean
  }) => Promise<any>
  retrieveToolingTypes: (args: {
    types: Record<string, string[]>
  }) => Promise<any>
  describeCustomObject: (objectName: string) => Promise<any>
}

type ConnectionRecord = {
  instanceUrl: string
  apiVersion: string
  accessToken: string
  authType: string
  username: string
  userId: string
  orgId: string
  organizationName: string
  organizationType: string
  isSandbox: boolean | null
  isScratch: boolean | null
  workspaceRoot: string
  hasConnection: boolean
  sessionHasExpired: boolean
  hasError: boolean
  errorMessage: string | null
}

type BridgeConnectionContext = {
  getContext: () => Record<string, unknown>
  refreshStatus: () => Promise<void>
  onHostEvent: (
    listener: (event: IframeJsforceBridgeHostEvent) => void
  ) => { dispose: () => void }
  dispose: () => void
}

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function hasOwnValue(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function normalizeApiVersion(value: unknown, fallback = '63.0') {
  return asString(value) || fallback
}

function parseJson(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }
  const raw = value.trim()
  if (!raw) {
    return undefined
  }
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function buildMockZipBase64() {
  const packageXml = new TextEncoder().encode(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
      '  <version>63.0</version>',
      '</Package>'
    ].join('\n')
  )
  const archive = zipSync({ 'unpackaged/package.xml': packageXml })
  return bytesToBase64(archive)
}

function createDefaultConnectionRecord(apiVersion: string, workspaceRoot: string): ConnectionRecord {
  return {
    instanceUrl: 'https://mock.salesforce.local',
    apiVersion,
    accessToken: 'bridge-session-token',
    authType: 'session',
    username: 'bridge.user',
    userId: 'bridge-user-id',
    orgId: 'bridge-org-id',
    organizationName: 'Bridge Org',
    organizationType: 'Sandbox',
    isSandbox: true,
    isScratch: false,
    workspaceRoot,
    hasConnection: true,
    sessionHasExpired: false,
    hasError: false,
    errorMessage: null
  }
}

function buildMetadataTypesFromRetrieveRequest(request: Record<string, unknown>) {
  const unpackaged =
    request.unpackaged && typeof request.unpackaged === 'object'
      ? (request.unpackaged as Record<string, unknown>)
      : {}
  const types = Array.isArray(unpackaged.types) ? unpackaged.types : []
  const output: Record<string, string[]> = {}
  for (const typeEntry of types) {
    if (!typeEntry || typeof typeEntry !== 'object') {
      continue
    }
    const entry = typeEntry as Record<string, unknown>
    const typeName = asString(entry.name)
    if (!typeName) {
      continue
    }
    const members = (Array.isArray(entry.members) ? entry.members : [entry.members])
      .map(asString)
      .filter(Boolean)
    if (!members.length) {
      continue
    }
    output[typeName] = members
  }
  return output
}

function createMockBridgeClient(workspaceRoot: string): BridgeClient {
  const mockZip = buildMockZipBase64()
  return {
    async getConnectionStatus() {
      return {
        connected: true,
        instanceUrl: 'https://mock.salesforce.local',
        apiVersion: '63.0',
        accessTokenAvailable: true,
        username: 'mock.user',
        userId: 'mock-user-id',
        orgId: 'mock-org-id',
        organizationName: 'Mock Org',
        workspaceRoot,
        sessionHasExpired: false,
        hasError: false,
        errorMessage: null
      }
    },
    async executeSoql({ query, mode = 'standard' }) {
      return { mode, query, records: [], totalSize: 0 }
    },
    async executeAnonymous(apexCode: string) {
      return { compiled: true, success: true, apexCode, logs: '' }
    },
    async executeApi({ endpoint, method = 'GET', body }) {
      return { endpoint, method, body: body ?? null }
    },
    async runApexTests({ classIds = [], classNames = [] } = {}) {
      return {
        jobId: `mock-apex-tests-${Date.now()}`,
        classIds,
        classNames,
        queueItems: [],
        results: [],
        failures: [],
        coverage: [],
        summary: { total: 0, passed: 0, failed: 0 }
      }
    },
    async listMetadataTypes() {
      return [
        { xmlName: 'ApexClass', inFolder: false },
        { xmlName: 'ApexTrigger', inFolder: false },
        { xmlName: 'LightningComponentBundle', inFolder: false },
        { xmlName: 'AuraDefinitionBundle', inFolder: false },
        { xmlName: 'CustomObject', inFolder: false }
      ]
    },
    async listMetadata() {
      return []
    },
    async retrieveViaMetadataApi() {
      return {
        id: `mock-retrieve-${Date.now()}`,
        done: true,
        success: true,
        status: 'Succeeded',
        errorMessage: '',
        zipFile: mockZip
      }
    },
    async retrieveToolingTypes() {
      return { unsupportedTypes: [], types: {} }
    },
    async describeCustomObject(objectName: string) {
      return { name: objectName, fields: [] }
    }
  }
}

export async function createBridgeConnectionContext({
  apiVersion = '63.0',
  workspaceRoot = '/workspace'
}: {
  apiVersion?: string
  workspaceRoot?: string
} = {}): Promise<BridgeConnectionContext> {
  const connectionRecord = createDefaultConnectionRecord(normalizeApiVersion(apiVersion), workspaceRoot)
  const retrieveStatusById = new Map<string, Record<string, unknown>>()
  const deployStatusById = new Map<string, Record<string, unknown>>()
  const fallbackZip = buildMockZipBase64()

  let bridgeClient: BridgeClient | null = null
  let bridgeClientPromise: Promise<BridgeClient> | null = null
  let bridgeHostEventDisposable: { dispose?: () => void } | null = null
  let disposed = false

  const hostEventListeners = new Set<(event: IframeJsforceBridgeHostEvent) => void>()

  const emitHostEvent = (event: IframeJsforceBridgeHostEvent) => {
    for (const listener of Array.from(hostEventListeners)) {
      try {
        listener(event)
      } catch {
        // ignore listener errors
      }
    }
  }

  const onHostEvent = (listener: (event: IframeJsforceBridgeHostEvent) => void) => {
    if (typeof listener !== 'function') {
      return { dispose() {} }
    }
    hostEventListeners.add(listener)
    return {
      dispose: () => {
        hostEventListeners.delete(listener)
      }
    }
  }

  const applyConnectionStatePayload = (payload: Record<string, unknown>) => {
    if (hasOwnValue(payload, 'instanceUrl')) {
      connectionRecord.instanceUrl = asString(payload.instanceUrl)
    }
    if (hasOwnValue(payload, 'apiVersion')) {
      connectionRecord.apiVersion = normalizeApiVersion(payload.apiVersion, connectionRecord.apiVersion)
    }
    if (hasOwnValue(payload, 'workspaceRoot')) {
      connectionRecord.workspaceRoot = asString(payload.workspaceRoot)
    }
    if (hasOwnValue(payload, 'username')) {
      connectionRecord.username = asString(payload.username)
    }
    if (hasOwnValue(payload, 'userId')) {
      connectionRecord.userId = asString(payload.userId)
    }
    if (hasOwnValue(payload, 'orgId')) {
      connectionRecord.orgId = asString(payload.orgId)
    }
    if (hasOwnValue(payload, 'organizationName')) {
      connectionRecord.organizationName = asString(payload.organizationName)
    }
    if (hasOwnValue(payload, 'sessionHasExpired')) {
      connectionRecord.sessionHasExpired = Boolean(payload.sessionHasExpired)
    }
    if (hasOwnValue(payload, 'hasError')) {
      connectionRecord.hasError = Boolean(payload.hasError)
    }
    if (hasOwnValue(payload, 'errorMessage')) {
      const message = asString(payload.errorMessage)
      connectionRecord.errorMessage =
        message || (connectionRecord.hasError ? 'Bridge connection failed.' : null)
    } else if (!connectionRecord.hasError) {
      connectionRecord.errorMessage = null
    }
    if (hasOwnValue(payload, 'connected')) {
      connectionRecord.hasConnection =
        Boolean(payload.connected) && !connectionRecord.sessionHasExpired && !connectionRecord.hasError
    } else {
      connectionRecord.hasConnection = !connectionRecord.sessionHasExpired && !connectionRecord.hasError
    }
  }

  const shouldRefreshStatusFromBannerAction = (payload: Record<string, unknown>) => {
    const action = asString(payload.action)
    const status = asString(payload.status)
    if (status !== 'completed' && status !== 'failed' && status !== 'cancelled') {
      return false
    }
    return action === 'reconnectManually' || action === 'importBrowserOrg'
  }

  const handleHostEvent = (event: IframeJsforceBridgeHostEvent) => {
    const eventName = asString(event?.eventName)
    const payload =
      event?.payload && typeof event.payload === 'object'
        ? (event.payload as Record<string, unknown>)
        : null

    if (eventName === 'connection.state' && payload) {
      applyConnectionStatePayload(payload)
    } else if (eventName === 'banner.action' && payload && shouldRefreshStatusFromBannerAction(payload)) {
      void refreshStatus()
    }

    emitHostEvent({
      eventName,
      payload
    })
  }

  const resolveBridgeClient = async () => {
    if (bridgeClient) {
      return bridgeClient
    }
    if (bridgeClientPromise) {
      return await bridgeClientPromise
    }
    bridgeClientPromise = (async () => {
      if (!isIframeJsforceBridgeEnabled()) {
        return createMockBridgeClient(connectionRecord.workspaceRoot)
      }
      try {
        const client = await connectIframeJsforceBridgeClient()
        if (typeof client.onHostEvent === 'function') {
          try {
            bridgeHostEventDisposable?.dispose?.()
          } catch {
            // ignore
          }
          bridgeHostEventDisposable = client.onHostEvent(handleHostEvent)
        }
        return client
      } catch (error) {
        console.warn('[sfWorkbench] JSForce bridge unavailable, using mock client.', error)
        return createMockBridgeClient(connectionRecord.workspaceRoot)
      }
    })()
    bridgeClient = await bridgeClientPromise
    bridgeClientPromise = null
    return bridgeClient
  }

  const refreshStatus = async () => {
    try {
      const client = await resolveBridgeClient()
      const status = await client.getConnectionStatus()
      connectionRecord.instanceUrl = asString(status.instanceUrl) || connectionRecord.instanceUrl
      connectionRecord.apiVersion = normalizeApiVersion(status.apiVersion, connectionRecord.apiVersion)
      connectionRecord.workspaceRoot = asString(status.workspaceRoot) || connectionRecord.workspaceRoot
      connectionRecord.username = asString(status.username) || connectionRecord.username
      connectionRecord.userId = asString(status.userId) || connectionRecord.userId
      connectionRecord.orgId = asString(status.orgId) || connectionRecord.orgId
      connectionRecord.organizationName =
        asString(status.organizationName) || connectionRecord.organizationName
      connectionRecord.sessionHasExpired = Boolean(status.sessionHasExpired)
      connectionRecord.hasError = Boolean(status.hasError)
      connectionRecord.errorMessage = status.errorMessage
        ? String(status.errorMessage)
        : connectionRecord.hasError
          ? 'Bridge connection failed.'
          : null
      connectionRecord.hasConnection =
        Boolean(status.connected) &&
        !connectionRecord.sessionHasExpired &&
        !connectionRecord.hasError
    } catch (error) {
      connectionRecord.hasError = true
      connectionRecord.hasConnection = false
      connectionRecord.errorMessage =
        error instanceof Error ? error.message : 'Unable to resolve bridge status.'
    }
  }

  const bridgeBackedConnection = {
    get instanceUrl() {
      return connectionRecord.instanceUrl
    },
    get version() {
      return connectionRecord.apiVersion
    },
    get accessToken() {
      return connectionRecord.accessToken
    },
    async request({
      method = 'GET',
      url,
      body,
      headers
    }: {
      method: string
      url: string
      body?: string
      headers?: Record<string, string>
    }) {
      const client = await resolveBridgeClient()
      return await client.executeApi({
        endpoint: String(url || ''),
        method: String(method || 'GET').toUpperCase() as
          | 'GET'
          | 'POST'
          | 'PUT'
          | 'PATCH'
          | 'DELETE',
        body: parseJson(body),
        headers
      })
    },
    tooling: {
      query(soql: string) {
        return {
          async run() {
            const client = await resolveBridgeClient()
            const response = await client.executeSoql({
              query: soql,
              mode: 'tooling'
            })
            return Array.isArray(response.records) ? response.records : []
          }
        }
      }
    },
    metadata: {
      async describe(asOfVersion: string) {
        const client = await resolveBridgeClient()
        const listed = await client.listMetadataTypes()
        return {
          organizationNamespace: null,
          partialSaveAllowed: false,
          testRequired: false,
          metadataObjects: (Array.isArray(listed) ? listed : []).map((entry) => ({
            xmlName: asString(entry.xmlName),
            inFolder: Boolean(entry.inFolder)
          })),
          asOfVersion: normalizeApiVersion(asOfVersion, connectionRecord.apiVersion)
        }
      },
      async list(
        queries: Array<{
          type?: string
          folder?: string
        }>
      ) {
        const client = await resolveBridgeClient()
        const output: Record<string, unknown>[] = []
        for (const query of Array.isArray(queries) ? queries : []) {
          const type = asString(query?.type)
          if (!type) {
            continue
          }
          // eslint-disable-next-line no-await-in-loop
          const entries = await client.listMetadata({
            type,
            folder: asString(query?.folder) || undefined
          })
          if (Array.isArray(entries)) {
            output.push(...entries)
          }
        }
        return output
      },
      async retrieve(request: Record<string, unknown>) {
        const client = await resolveBridgeClient()
        const response = await client.retrieveViaMetadataApi({
          types: buildMetadataTypesFromRetrieveRequest(request),
          includeZip: true
        })
        const id = asString(response.id) || `retrieve-${Date.now()}`
        retrieveStatusById.set(id, {
          id,
          done: true,
          success: response.success !== false,
          status: asString(response.status) || 'Succeeded',
          zipFile: asString(response.zipFile) || fallbackZip,
          errorMessage: asString(response.errorMessage)
        })
        return { id }
      },
      async checkRetrieveStatus(id: string, includeZip = true) {
        const status = retrieveStatusById.get(String(id))
        if (!status) {
          return {
            done: true,
            success: false,
            status: 'Unknown',
            zipFile: includeZip ? '' : undefined,
            errorMessage: `Unknown retrieve id: ${id}`
          }
        }
        return {
          ...status,
          zipFile: includeZip ? status.zipFile : undefined
        }
      },
      async deploy(_zipB64: string, options: { checkOnly?: boolean } = {}) {
        const id = `deploy-${Date.now()}-${Math.random().toString(16).slice(2)}`
        deployStatusById.set(id, {
          id,
          done: true,
          success: true,
          status: options.checkOnly ? 'Validated' : 'Succeeded',
          errorMessage: ''
        })
        return { id }
      },
      async checkDeployStatus(id: string) {
        const status = deployStatusById.get(String(id))
        if (!status) {
          return {
            done: true,
            success: false,
            status: 'Unknown',
            errorMessage: `Unknown deploy id: ${id}`
          }
        }
        return status
      }
    }
  }

  await refreshStatus()

  return {
    getContext() {
      return {
        connector: { conn: bridgeBackedConnection },
        connection: { ...connectionRecord },
        getConnectionRecord: () => ({ ...connectionRecord }),
        apiVersion: connectionRecord.apiVersion,
        workspaceRoot: connectionRecord.workspaceRoot,
        sessionHasExpired: connectionRecord.sessionHasExpired,
        hasError: connectionRecord.hasError,
        errorMessage: connectionRecord.errorMessage
      }
    },
    refreshStatus,
    onHostEvent,
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      try {
        bridgeClient?.dispose?.()
      } catch {
        // ignore
      }
      try {
        bridgeHostEventDisposable?.dispose?.()
      } catch {
        // ignore
      }
      bridgeClient = null
      bridgeClientPromise = null
      bridgeHostEventDisposable = null
      hostEventListeners.clear()
    }
  }
}
