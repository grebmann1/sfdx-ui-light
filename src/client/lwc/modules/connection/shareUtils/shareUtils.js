import { encodeJsonToBase64Url, isEmpty } from 'shared/utils';

function getDefaultBasePath() {
    const origin =
        typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    return origin ? `${origin}/app` : '/app';
}

export function buildConnectionShareMessage(connection, { basePath } = {}) {
    const c = connection || {};
    const effectiveBasePath = basePath || getDefaultBasePath();

    const company = c.company || '';
    const name = c.name || '';
    const alias = c.alias || '';
    const orgId = c.orgId || '';
    const username = c.username || '';
    const instanceUrl = c.instanceUrl || '';
    const credentialType = c.credentialType || '';
    const password = c.password || '';
    const redirectUrl = c.redirectUrl || '';
    const sfdxAuthUrl = c.sfdxAuthUrl || '';

    if (credentialType === 'USERNAME') {
        const lines = [
            '--- SF Toolkit Connection (Username/Password) ---',
            `Category: ${company}`,
            `Name: ${name}`,
            `Alias: ${alias}`,
            `Credential Type: ${credentialType || 'USERNAME'}`,
            `OrgId: ${orgId}`,
            `Username: ${username}`,
            `Instance Url: ${instanceUrl}`,
            `Password: ${password}`,
            '',
            'Connect (prefill username, enter password in app):',
        ];

        if (!isEmpty(alias) && !isEmpty(username) && !isEmpty(instanceUrl)) {
            const shareUserPayload = encodeJsonToBase64Url({
                v: 1,
                alias,
                username,
                instanceUrl,
                company,
                name,
            });
            lines.push(`${effectiveBasePath}?shareUser=${encodeURIComponent(shareUserPayload)}`);
        }

        return lines.join('\n');
    }

    if (credentialType === 'OAUTH') {
        const lines = [
            '--- SF Toolkit Connection (OAuth) ---',
            `Category: ${company}`,
            `Name: ${name}`,
            `Alias: ${alias}`,
            `Credential Type: ${credentialType || 'OAUTH'}`,
            `OrgId: ${orgId}`,
            `Username: ${username}`,
            `Instance Url: ${instanceUrl}`,
            '',
            'Connect (add org and sign in with refresh token):',
        ];

        if (!isEmpty(alias) && !isEmpty(sfdxAuthUrl)) {
            const sharePayload = encodeJsonToBase64Url({
                v: 1,
                alias,
                sfdxAuthUrl,
            });
            lines.push(`${effectiveBasePath}?share=${encodeURIComponent(sharePayload)}`);
        }

        return lines.filter(Boolean).join('\n');
    }

    return [
        '--- SF Toolkit Connection ---',
        `Category: ${company}`,
        `Name: ${name}`,
        `Alias: ${alias}`,
        `Credential Type: ${credentialType}`,
        redirectUrl ? `Redirect Url: ${redirectUrl}` : '',
    ]
        .filter(Boolean)
        .join('\n');
}

