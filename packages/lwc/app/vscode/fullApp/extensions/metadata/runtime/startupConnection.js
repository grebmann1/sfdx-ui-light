export const INJECTED_CONNECTOR_REQUIRED_MESSAGE =
    'Salesforce connection is required to open this workbench. Launch it from a connected toolkit session.';

export function describeStartupConnectionState(connection = null) {
    const hasConnection = Boolean(connection?.instanceUrl && connection?.accessToken);
    return {
        hasConnection,
        message: hasConnection ? null : INJECTED_CONNECTOR_REQUIRED_MESSAGE,
    };
}
