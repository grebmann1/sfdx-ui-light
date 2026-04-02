const SOURCE_TRACKING_PATH = '/workspace/.salesforce/source-tracking.json';

function parentPath(p) {
    const path = String(p || '');
    const idx = path.lastIndexOf('/');
    return idx > 0 ? path.slice(0, idx) : '/';
}

async function ensureDir(vscode, absPath) {
    try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(absPath));
    } catch {
        // ignore
    }
}

export function getSourceTrackingPath() {
    return SOURCE_TRACKING_PATH;
}

export function pickRemoteStamp(rec) {
    const v = rec?.SystemModstamp || rec?.LastModifiedDate || rec?.LastModifieddate || null;
    if (!v) return null;
    // Salesforce typically returns ISO strings; keep it as a string.
    return String(v);
}

// Fast, deterministic, non-cryptographic hash for change detection.
export function hashText(text) {
    const s = String(text ?? '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h) ^ s.charCodeAt(i);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

export async function loadSourceTracking(vscode) {
    try {
        const uri = vscode.Uri.file(SOURCE_TRACKING_PATH);
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder().decode(bytes || new Uint8Array());
        const parsed = JSON.parse(text || '{}');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export async function saveSourceTracking(vscode, tracking) {
    const payload = tracking && typeof tracking === 'object' ? tracking : {};
    const text = JSON.stringify(payload, null, 2);
    await ensureDir(vscode, parentPath(SOURCE_TRACKING_PATH));
    await vscode.workspace.fs.writeFile(
        vscode.Uri.file(SOURCE_TRACKING_PATH),
        new TextEncoder().encode(text)
    );
}

