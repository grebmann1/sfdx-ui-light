export function createObjectUrl(content: string, mimeType: string) {
    return URL.createObjectURL(new Blob([content], { type: mimeType }));
}

export async function fetchTextAsset(sourcePath: string) {
    const response = await fetch(sourcePath);
    return response.text();
}
