export const OAUTH_TYPES = {
  OAUTH: 'oauth',
  SESSION: 'session',
  USERNAME: 'username',
  JWT: 'jwt'
} as const

type ConnectorLike = {
  conn?: Record<string, unknown>
}

function toStringValue(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function toBooleanOrNull(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }
  if (value == null || value === '') {
    return null
  }
  return String(value).toLowerCase() === 'true'
}

export function normalizeOrganizationType(value: unknown) {
  const normalized = toStringValue(value).trim()
  return normalized || 'Unknown'
}

export function normalizeScratchValue(value: unknown) {
  return toBooleanOrNull(value)
}

export function normalizeSandboxValue(value: unknown) {
  return toBooleanOrNull(value)
}

export function inferScratchValue(connection: Record<string, unknown> | null | undefined) {
  if (!connection) {
    return null
  }
  return normalizeScratchValue(connection.isScratch)
}

export function inferSandboxValue(connection: Record<string, unknown> | null | undefined) {
  if (!connection) {
    return null
  }
  return normalizeSandboxValue(connection.isSandbox)
}

export function getOrgHost(connection: Record<string, unknown> | null | undefined) {
  const instanceUrl = toStringValue(connection?.instanceUrl)
  if (!instanceUrl) {
    return ''
  }
  try {
    return new URL(instanceUrl).host
  } catch {
    return instanceUrl.replace(/^https?:\/\//, '')
  }
}

export function getConnectionAuthType(connection: Record<string, unknown> | null | undefined) {
  const authType = toStringValue(connection?.authType).toLowerCase()
  if (authType) {
    return authType
  }
  return toStringValue(connection?.oauthConnectionId) ? OAUTH_TYPES.OAUTH : OAUTH_TYPES.SESSION
}

export function buildConnectionFromConnector(
  connector: ConnectorLike | null | undefined,
  fallbackApiVersion = '63.0'
) {
  const liveConnection = (connector?.conn as Record<string, unknown>) ?? null
  if (!liveConnection) {
    return null
  }

  const instanceUrl = toStringValue(liveConnection.instanceUrl)
  const accessToken = toStringValue(liveConnection.accessToken || liveConnection.sessionId)
  const username = toStringValue(liveConnection.username)
  const orgId = toStringValue(liveConnection.orgId)
  const userId = toStringValue(liveConnection.userId)
  const organizationName = toStringValue(liveConnection.organizationName)
  const organizationType = normalizeOrganizationType(liveConnection.organizationType)
  const apiVersion = toStringValue(liveConnection.version || liveConnection.apiVersion || fallbackApiVersion)
  const authType = getConnectionAuthType(liveConnection)

  return {
    instanceUrl,
    apiVersion: apiVersion || fallbackApiVersion,
    accessToken,
    authType,
    oauthConnectionId: toStringValue(liveConnection.oauthConnectionId),
    username,
    userId,
    orgId,
    organizationName,
    organizationType,
    isSandbox: inferSandboxValue(liveConnection),
    isScratch: inferScratchValue(liveConnection),
    hasConnection: Boolean(instanceUrl && accessToken),
    sessionHasExpired: Boolean(liveConnection.sessionHasExpired),
    hasError: Boolean(liveConnection.hasError),
    errorMessage:
      typeof liveConnection.errorMessage === 'string' ? liveConnection.errorMessage : null
  }
}
