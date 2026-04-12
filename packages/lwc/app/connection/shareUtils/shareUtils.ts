import { encodeJsonToBase64Url, isEmpty } from 'shared/utils';
import { OAUTH_TYPES } from 'core/connector';

type ShareOptions = {
    basePath?: string;
};

type ConnectionLike = {
    company?: string;
    name?: string;
    alias?: string;
    orgId?: string;
    username?: string;
    instanceUrl?: string;
    credentialType?: string;
    password?: string;
    redirectUrl?: string;
    sfdxAuthUrl?: string;
};

function getDefaultBasePath() {
    const origin =
        typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    return origin ? `${origin}/app` : '/app';
}

export function buildConnectionShareMessage(
    connection: ConnectionLike,
    { basePath }: ShareOptions = {}
) {
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

    if (credentialType === OAUTH_TYPES.USERNAME) {
        const lines = [
            '--- Workbench Connection (Username/Password) ---',
            `Category: ${company}`,
            `Name: ${name}`,
            `Alias: ${alias}`,
            `Credential Type: ${credentialType || OAUTH_TYPES.USERNAME}`,
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

    if (credentialType === OAUTH_TYPES.OAUTH) {
        const lines = [
            '--- Workbench Connection (OAuth) ---',
            `Category: ${company}`,
            `Name: ${name}`,
            `Alias: ${alias}`,
            `Credential Type: ${credentialType || OAUTH_TYPES.OAUTH}`,
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
        '--- Workbench Connection ---',
        `Category: ${company}`,
        `Name: ${name}`,
        `Alias: ${alias}`,
        `Credential Type: ${credentialType}`,
        redirectUrl ? `Redirect Url: ${redirectUrl}` : '',
    ]
        .filter(Boolean)
        .join('\n');
}
