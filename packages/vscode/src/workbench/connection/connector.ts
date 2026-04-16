export const OAUTH_TYPES = {
  OAUTH: 'oauth',
  SESSION: 'session',
  USERNAME: 'username',
  JWT: 'jwt'
} as const

type ConnectorLike = {
  conn?: Record<string, unknown>
  configuration?: Record<string, unknown>
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

  // Identity fields like orgId, username, userId, organizationName are written to
  // connector.configuration by _enrichConnector (via identity() call), not to connector.conn.
  // Always prefer conn values first, then fall back to configuration so that post-enrichment
  // identity data is not silently dropped.
  const configuration = (connector?.configuration as Record<string, unknown>) ?? {}
  const userInfo = ((configuration.userInfo ?? liveConnection.userInfo) as Record<string, unknown>) ?? {}

  const instanceUrl = toStringValue(liveConnection.instanceUrl || configuration.instanceUrl)
  const accessToken = toStringValue(liveConnection.accessToken || liveConnection.sessionId || configuration.accessToken)
  const username = toStringValue(liveConnection.username || configuration.username || userInfo.username)
  const orgId = toStringValue(liveConnection.orgId || configuration.orgId || userInfo.organization_id)
  const userId = toStringValue(liveConnection.userId || userInfo.user_id || userInfo.id || configuration.userId)
  const organizationName = toStringValue(
    liveConnection.organizationName ||
    configuration.organizationName ||
    (configuration.orgName as unknown) ||
    userInfo.organization_name
  )
  const organizationType = normalizeOrganizationType(
    liveConnection.organizationType || configuration.organizationType || configuration.orgType
  )
  const apiVersion = toStringValue(liveConnection.version || liveConnection.apiVersion || configuration.version || fallbackApiVersion)
  const authType = getConnectionAuthType(liveConnection)

  // isSandbox / isScratch are also resolved during enrichment and stored on configuration.
  const isSandbox = inferSandboxValue(liveConnection) ?? normalizeSandboxValue(configuration.isSandbox ?? configuration.sandbox)
  const isScratch = inferScratchValue(liveConnection) ?? normalizeScratchValue(configuration.isScratch ?? configuration.scratch)

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
    isSandbox,
    isScratch,
    hasConnection: Boolean(instanceUrl && accessToken),
    sessionHasExpired: Boolean(liveConnection.sessionHasExpired),
    hasError: Boolean(liveConnection.hasError),
    errorMessage:
      typeof liveConnection.errorMessage === 'string' ? liveConnection.errorMessage : null
  }
}
