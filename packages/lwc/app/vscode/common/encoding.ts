export function encodeUtf8(text: string | null | undefined) {
    return new TextEncoder().encode(text ?? '');
}
