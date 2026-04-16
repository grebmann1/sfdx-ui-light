type ShellHandlers = {
    executeApex?: (args: { apexCode: string; sourceFilePath?: string }) => Promise<{
      exitCode?: number
      result?: unknown
    }>
    executeSoql?: (args: {
      query: string
      includeDeletedRecords?: boolean
      useToolingApi?: boolean
    }) => Promise<{ result?: unknown }>
    executeApi?: (args: {
      endpoint: string
      method?: string
      body?: string
      headerValues?: string[]
    }) => Promise<{ result?: unknown }>
    listOrgs?: () => Promise<{ result?: unknown }>
    openOrg?: (args: { alias: string }) => Promise<{ result?: unknown }>
  }
  
  type BashLike = {
    handlers: ShellHandlers
  }
  
  type ShellRunResult = {
    command: string
    cwd: string
    stdout: string
    stderr: string
    exitCode: number
  }
  
  function splitCommand(command: string) {
    return String(command || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
  }
  
  function stringifyResult(value: unknown) {
    if (typeof value === 'string') {
      return value
    }
    if (value == null) {
      return ''
    }
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  
  export function createBashInstance(): BashLike {
    return { handlers: {} }
  }
  
  export function registerSalesforceShellCommands({
    shell,
    handlers
  }: {
    shell: BashLike
    handlers: ShellHandlers
  }) {
    shell.handlers = handlers
  }
  
  export function getApexExecutionExitCode(result: unknown) {
    const payload = (result ?? {}) as Record<string, unknown>
    if (payload.success === true && payload.compiled === true) {
      return 0
    }
    return 1
  }
  
  async function dispatchCommand(shell: BashLike, command: string) {
    const parts = splitCommand(command)
    const handlers = shell.handlers
    if (parts.length === 0 || parts[0] !== 'sf') {
      return null
    }
  
    if (parts[1] === 'org' && parts[2] === 'list') {
      return await handlers.listOrgs?.()
    }
    if (parts[1] === 'org' && parts[2] === 'open') {
      const alias = parts[parts.length - 1] || ''
      return await handlers.openOrg?.({ alias })
    }
    if (parts[1] === 'data' && parts[2] === 'query') {
      const queryIndex = parts.findIndex((part) => part === '--query' || part === '-q')
      const query =
        queryIndex >= 0 && queryIndex + 1 < parts.length ? parts[queryIndex + 1] : ''
      return await handlers.executeSoql?.({
        query,
        includeDeletedRecords: parts.includes('--all-rows'),
        useToolingApi: parts.includes('--use-tooling-api')
      })
    }
    if (parts[1] === 'apex' && parts[2] === 'run') {
      return await handlers.executeApex?.({ apexCode: '' })
    }
    if (parts[1] === 'api' && parts[2] === 'request') {
      const endpointIndex = parts.findIndex((part) => part === '--endpoint')
      const endpoint =
        endpointIndex >= 0 && endpointIndex + 1 < parts.length ? parts[endpointIndex + 1] : '/'
      return await handlers.executeApi?.({ endpoint })
    }
    return {
      result: `Command "${command}" is not implemented in this workbench shell compatibility layer.`
    }
  }
  
  export function createShellRunner({ bash }: { bash: BashLike }) {
    let cwd = '/workspace'
    return {
      getCwd() {
        return cwd
      },
      async run(command: string, { cwd: nextCwd }: { cwd?: string } = {}): Promise<ShellRunResult> {
        if (typeof nextCwd === 'string' && nextCwd.trim()) {
          cwd = nextCwd
        }
        try {
          const payload = await dispatchCommand(bash, command)
          return {
            command,
            cwd,
            stdout: stringifyResult(payload?.result),
            stderr: '',
            exitCode: payload == null ? 127 : 0
          }
        } catch (error) {
          return {
            command,
            cwd,
            stdout: '',
            stderr: error instanceof Error ? error.message : String(error),
            exitCode: 1
          }
        }
      }
    }
  }
  