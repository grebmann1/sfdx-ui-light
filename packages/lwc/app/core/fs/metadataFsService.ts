const SFDX_ROOT_SEGMENTS = ['force-app', 'main', 'default'];

type MinimalFs = {
    mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
    writeFile: (path: string, body: string, encoding?: string) => Promise<void>;
};

const METADATA_FOLDER_BY_TYPE = {
    ApexClass: 'classes',
    ApexTrigger: 'triggers',
    ApexPage: 'pages',
    ApexComponent: 'components',
    LightningComponentBundle: 'lwc',
    AuraDefinitionBundle: 'aura',
    CustomObject: 'objects',
    Profile: 'profiles',
    PermissionSet: 'permissionsets',
    StaticResource: 'staticresources',
    Flow: 'flows',
};

const XML_ESCAPE_REPLACEMENTS = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
};

const xmlEscape = value =>
    String(value ?? '').replace(/[&<>"']/g, char => XML_ESCAPE_REPLACEMENTS[char] || char);

const sanitizePathSegment = value =>
    String(value ?? '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_');

const getAliasRoot = alias => {
    const normalizedAlias = sanitizePathSegment(alias);
    if (!normalizedAlias) return null;
    return `/workspace/orgs/${normalizedAlias}`;
};

const getSfdxRoot = alias => {
    const root = getAliasRoot(alias);
    if (!root) return null;
    return `${root}/${SFDX_ROOT_SEGMENTS.join('/')}`;
};

const ensureDirectory = async (fs: MinimalFs, path: string) => {
    await fs.mkdir(path, { recursive: true });
};

const writeFile = async (fs: MinimalFs, path: string, body: string | null | undefined) => {
    await ensureDirectory(fs, path.split('/').slice(0, -1).join('/'));
    await fs.writeFile(path, body ?? '', 'utf8');
};

const parseLwcResourcePath = resourcePath => {
    const normalized = String(resourcePath || '').replace(/^\/+/, '');
    const [bundleName, ...rest] = normalized.split('/');
    return {
        bundleName: sanitizePathSegment(bundleName),
        fileName: sanitizePathSegment(rest.join('/')),
    };
};

const toBundleMetaXml = (apiVersion = '63.0') => `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${xmlEscape(apiVersion)}</apiVersion>
    <isExposed>false</isExposed>
</LightningComponentBundle>
`;

const toSourceMetaXml = (type, apiVersion = '63.0') => `<?xml version="1.0" encoding="UTF-8"?>
<${type} xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${xmlEscape(apiVersion)}</apiVersion>
    <status>Active</status>
</${type}>
`;

const getPrimaryName = ({ label1, recordId, selectedRecord, metadataType }) => {
    return sanitizePathSegment(
        selectedRecord?.FullName ||
            selectedRecord?.DeveloperName ||
            selectedRecord?.MasterLabel ||
            selectedRecord?.Name ||
            label1 ||
            recordId ||
            metadataType
    );
};

const writeApexLike = async ({ fs, alias, metadataType, fileExtension, sourceMetaType, body }) => {
    const sfdxRoot = getSfdxRoot(alias);
    if (!sfdxRoot) return { status: 'skipped_no_alias' };
    const folder = METADATA_FOLDER_BY_TYPE[metadataType];
    const normalizedBody = body || {};
    const name = getPrimaryName({
        label1: normalizedBody.label1,
        recordId: normalizedBody.recordId,
        selectedRecord: normalizedBody.selectedRecord,
        metadataType,
    });
    const source = normalizedBody.files?.[0]?.body || normalizedBody.selectedRecord?.Body || '';
    const apiVersion =
        normalizedBody.files?.[0]?.apiVersion || normalizedBody.selectedRecord?.ApiVersion || '63.0';
    const sourcePath = `${sfdxRoot}/${folder}/${name}.${fileExtension}`;
    const metaPath = `${sourcePath}-meta.xml`;
    await writeFile(fs, sourcePath, source);
    await writeFile(fs, metaPath, toSourceMetaXml(sourceMetaType, apiVersion));
    return { status: 'stored', filesWritten: [sourcePath, metaPath] };
};

const writeLwcBundle = async ({ fs, alias, payload }) => {
    const sfdxRoot = getSfdxRoot(alias);
    if (!sfdxRoot) return { status: 'skipped_no_alias' };
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (files.length === 0) return { status: 'stored', filesWritten: [] };

    const writtenPaths = [];
    const first = files[0];
    const firstPath = parseLwcResourcePath(first.path || first.name || '');
    const bundleName = firstPath.bundleName || getPrimaryName({ metadataType: 'LightningComponentBundle' });
    const bundlePath = `${sfdxRoot}/lwc/${bundleName}`;
    await ensureDirectory(fs, bundlePath);
    for (const file of files) {
        const { fileName } = parseLwcResourcePath(file.path || file.name || '');
        if (!fileName) continue;
        const target = `${bundlePath}/${fileName}`;
        await writeFile(fs, target, file.body || '');
        writtenPaths.push(target);
    }
    const apiVersion = first?.apiVersion || payload.selectedRecord?.ApiVersion || '63.0';
    const metaPath = `${bundlePath}/${bundleName}.js-meta.xml`;
    await writeFile(fs, metaPath, toBundleMetaXml(apiVersion));
    writtenPaths.push(metaPath);
    return { status: 'stored', filesWritten: writtenPaths };
};

const writeAuraBundle = async ({ fs, alias, payload }) => {
    const sfdxRoot = getSfdxRoot(alias);
    if (!sfdxRoot) return { status: 'skipped_no_alias' };
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (files.length === 0) return { status: 'stored', filesWritten: [] };
    const writtenPaths = [];
    const first = files[0];
    const baseName = sanitizePathSegment((first.name || '').split('.')[0]);
    const bundleName = baseName || getPrimaryName({ metadataType: 'AuraDefinitionBundle' });
    const bundlePath = `${sfdxRoot}/aura/${bundleName}`;
    await ensureDirectory(fs, bundlePath);
    for (const file of files) {
        const target = `${bundlePath}/${sanitizePathSegment(file.name || file.path || 'bundle.file')}`;
        await writeFile(fs, target, file.body || '');
        writtenPaths.push(target);
    }
    return { status: 'stored', filesWritten: writtenPaths };
};

const writeJsonFallback = async ({ fs, alias, metadataType, payload }) => {
    const sfdxRoot = getSfdxRoot(alias);
    if (!sfdxRoot) return { status: 'skipped_no_alias' };
    const folder = METADATA_FOLDER_BY_TYPE[metadataType] || `metadata/${sanitizePathSegment(metadataType)}`;
    const name = getPrimaryName({
        label1: payload.label1,
        recordId: payload.recordId,
        selectedRecord: payload.selectedRecord,
        metadataType,
    });
    const target = `${sfdxRoot}/${folder}/${name}.json`;
    await writeFile(fs, target, JSON.stringify(payload.selectedRecord || payload, null, 2));
    return { status: 'stored', filesWritten: [target] };
};

const toPackageXml = (types = [], version = '63.0') => {
    const blocks = types
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .map(
            type => `    <types>
        <members>*</members>
        <name>${xmlEscape(type)}</name>
    </types>`
        )
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
${blocks}
    <version>${xmlEscape(version)}</version>
</Package>
`;
};

const normalizeZipEntryPath = entryPath => {
    const raw = String(entryPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!raw || raw.endsWith('/')) return null;
    if (raw.startsWith('unpackaged/')) {
        return raw.slice('unpackaged/'.length);
    }
    return raw;
};

export const __testables = {
    sanitizePathSegment,
    getAliasRoot,
    getSfdxRoot,
    toPackageXml,
    normalizeZipEntryPath,
};

export const createMetadataFsService = (fs: MinimalFs) => ({
    getAliasRoot,
    getSfdxRoot,

    async writePackageSnapshot({ alias, metadataTypes = [], apiVersion = '63.0' }) {
        const sfdxRoot = getSfdxRoot(alias);
        if (!sfdxRoot) return { status: 'skipped_no_alias', filePath: null };
        const manifestDir = `${getAliasRoot(alias)}/manifest`;
        await ensureDirectory(fs, manifestDir);
        const filePath = `${manifestDir}/package.xml`;
        await writeFile(fs, filePath, toPackageXml(metadataTypes, apiVersion));
        return { status: 'stored', filePath };
    },

    async writeRetrievedPackage({ alias, entries = [] }) {
        const sfdxRoot = getSfdxRoot(alias);
        if (!sfdxRoot) return { status: 'skipped_no_alias', filesWritten: [] };
        const safeEntries = Array.isArray(entries) ? entries : [];
        const written = [];
        for (const entry of safeEntries) {
            const relativePath = normalizeZipEntryPath(entry?.fileName || entry?.path || '');
            if (!relativePath) continue;
            const target = `${sfdxRoot}/${relativePath}`;
            await writeFile(fs, target, entry?.body || '');
            written.push(target);
        }
        return { status: 'stored', filesWritten: written };
    },

    async writeMetadataRecord({
        alias,
        metadataType,
        files = [],
        selectedRecord = null,
        label1 = null,
        recordId = null,
    }) {
        if (!alias) {
            return { status: 'skipped_no_alias', filesWritten: [] };
        }

        const payload = { files, selectedRecord, label1, recordId };
        if (metadataType === 'LightningComponentBundle') {
            return writeLwcBundle({ fs, alias, payload });
        }
        if (metadataType === 'AuraDefinitionBundle') {
            return writeAuraBundle({ fs, alias, payload });
        }
        if (metadataType === 'ApexClass') {
            return writeApexLike({
                fs,
                alias,
                metadataType,
                fileExtension: 'cls',
                sourceMetaType: 'ApexClass',
                body: payload,
            });
        }
        if (metadataType === 'ApexTrigger') {
            return writeApexLike({
                fs,
                alias,
                metadataType,
                fileExtension: 'trigger',
                sourceMetaType: 'ApexTrigger',
                body: payload,
            });
        }
        if (metadataType === 'ApexPage') {
            return writeApexLike({
                fs,
                alias,
                metadataType,
                fileExtension: 'page',
                sourceMetaType: 'ApexPage',
                body: payload,
            });
        }
        if (metadataType === 'ApexComponent') {
            return writeApexLike({
                fs,
                alias,
                metadataType,
                fileExtension: 'component',
                sourceMetaType: 'ApexComponent',
                body: payload,
            });
        }
        return writeJsonFallback({ fs, alias, metadataType, payload });
    },
});

export default createMetadataFsService;
