export type ConnectorConfiguration = {
    alias?: string;
    username?: string;
    credentialType?: string;
    orgId?: string;
    userInfo?: Record<string, any>;
    redirectUrl?: string;
    id?: string;
    name?: string;
    company?: string;
    _hasError?: boolean;
    _errorMessage?: string | null;
    [key: string]: any;
};

export type ConnectionLike = {
    accessToken?: string;
    instanceUrl?: string;
    version?: string;
    userInfo?: Record<string, any>;
    alias?: string;
    refreshToken?: string;
    oauth2?: {
        refreshToken?: (token: string) => Promise<Record<string, any>>;
    };
    tooling?: any;
    metadata?: any;
    on?: (event: string, handler: (...args: any[]) => void) => void;
    request?: (path: string, options?: any) => Promise<Record<string, any>>;
    query?: (soql: string) => any;
    sobject?: (name: string) => any;
    identity?: () => Promise<Record<string, any>>;
    _callOptions?: Record<string, any>;
    _maxSessionRefreshRetries?: number;
    [key: string]: any;
};

export type ConnectorLike = {
    conn: ConnectionLike | null;
    configuration: ConnectorConfiguration;
    frontDoorUrl?: string;
    redirectUrl?: string;
    dispose?: () => void;
    [key: string]: any;
};
