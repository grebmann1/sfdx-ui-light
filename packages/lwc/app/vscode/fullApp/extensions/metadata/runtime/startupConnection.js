export function pickStartupConnectionCandidate({
    currentConnection = null,
    sharedConnectionEntries = [],
    oauthCredentialType = '',
} = {}) {
    const sharedAlias = String(currentConnection?.sharedAlias || '').trim();
    if (sharedAlias) {
        return {
            type: 'stored-alias',
            connection: currentConnection,
        };
    }

    const oauthCandidates = (Array.isArray(sharedConnectionEntries) ? sharedConnectionEntries : [])
        .map(entry => entry?.configuration || null)
        .filter(
            configuration =>
                configuration?.alias && configuration?.credentialType === oauthCredentialType
        );

    if (oauthCandidates.length !== 1) {
        return null;
    }

    return {
        type: 'shared-oauth',
        configuration: oauthCandidates[0],
    };
}
