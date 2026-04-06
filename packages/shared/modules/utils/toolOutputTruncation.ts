export const MAX_TOOL_OUTPUT_CHARS = 30000;
export const TAIL_CHARS = 2000;
export const TOOL_OUTPUT_DIR = '/tmp/tool-outputs';
export const TOOL_OUTPUT_TRUNCATED_MARKER = '[OUTPUT TRUNCATED]';
export const PAGE_SIZE = 200;
export const SECTION_SEPARATOR = '\n\n';
export const SECTION_CONTENT_SEPARATOR = '\n';

type TruncationOptions = {
    maxToolOutputChars?: number;
    tailChars?: number;
};

export function buildCapNotice(path, totalChars) {
    return [
        `${TOOL_OUTPUT_TRUNCATED_MARKER} Full output (${totalChars} chars) saved to ${path}.`,
        'Page through it with bash:',
        `sed -n '1,${PAGE_SIZE}p' "${path}"`,
        `sed -n '${PAGE_SIZE + 1},${PAGE_SIZE * 2}p' "${path}"`,
        `rg "pattern" "${path}"`,
    ].join('\n');
}

export function buildHeadSectionHeader(chars) {
    return `[HEAD: first ${chars} chars of output]`;
}

export function buildTailSectionHeader() {
    return `[TAIL: last ${TAIL_CHARS} chars of output]`;
}

export function buildTruncationSummary(path, totalChars) {
    return `[... TRUNCATED (${totalChars} chars total, saved to ${path}) ...]`;
}

export function buildTruncatedText(text, savedPath, notice, options: TruncationOptions = {}) {
    const maxToolOutputChars = options.maxToolOutputChars ?? MAX_TOOL_OUTPUT_CHARS;
    const totalLength = text.length;
    const tail = text.slice(-(options.tailChars ?? TAIL_CHARS));
    const tailHeader = buildTailSectionHeader();
    const truncationSummary = buildTruncationSummary(savedPath, totalLength);
    const maxHeadLength = (headHeaderLength) =>
        Math.max(
            0,
            maxToolOutputChars -
                tail.length -
                notice.length -
                truncationSummary.length -
                headHeaderLength -
                tailHeader.length -
                SECTION_CONTENT_SEPARATOR.length * 2 -
                SECTION_SEPARATOR.length * 3
        );
    let headLength = maxHeadLength(buildHeadSectionHeader(0).length);
    for (;;) {
        const next = maxHeadLength(buildHeadSectionHeader(headLength).length);
        if (next === headLength) break;
        headLength = next;
    }
    let head = text.slice(0, headLength);
    let combined = [
        `${buildHeadSectionHeader(head.length)}${SECTION_CONTENT_SEPARATOR}${head}`,
        truncationSummary,
        `${buildTailSectionHeader()}${SECTION_CONTENT_SEPARATOR}${tail}`,
        notice,
    ].join(SECTION_SEPARATOR);
    if (combined.length > maxToolOutputChars) {
        head = head.slice(0, Math.max(0, head.length - (combined.length - maxToolOutputChars)));
        combined = [
            `${buildHeadSectionHeader(head.length)}${SECTION_CONTENT_SEPARATOR}${head}`,
            truncationSummary,
            `${buildTailSectionHeader()}${SECTION_CONTENT_SEPARATOR}${tail}`,
            notice,
        ].join(SECTION_SEPARATOR);
    }
    return combined;
}
