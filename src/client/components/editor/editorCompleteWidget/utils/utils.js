import LOGGER from 'shared/logger';
export { StreamParser } from './codeExtract';

export const tripleTick = ['```', '```'];

export const defaultQuickEditFimTags = {
    preTag: 'ABOVE',
    sufTag: 'BELOW',
    midTag: 'SELECTION',
};

export const voidPrefixAndSuffix = ({ fullFileStr, startLine, endLine }) => {
    const fullFileLines = fullFileStr.split('\n');

    // we can optimize this later
    const MAX_PREFIX_SUFFIX_CHARS = 20_000;
    /*

	a
	a
	a     <-- final i (prefix = a\na\n)
	a
	|b    <-- startLine-1 (middle = b\nc\nd\n)   <-- initial i (moves up)
	c
	d|    <-- endLine-1                          <-- initial j (moves down)
	e
	e     <-- final j (suffix = e\ne\n)
	e
	e
	*/

    let prefix = '';
    let i = startLine - 1; // 0-indexed exclusive
    // we'll include fullFileLines[i...(startLine-1)-1].join('\n') in the prefix.
    while (i !== 0) {
        const newLine = fullFileLines[i - 1];
        if (newLine.length + 1 + prefix.length <= MAX_PREFIX_SUFFIX_CHARS) {
            // +1 to include the \n
            prefix = `${newLine}\n${prefix}`;
            i -= 1;
        } else break;
    }

    let suffix = '';
    let j = endLine - 1;
    while (j !== fullFileLines.length - 1) {
        const newLine = fullFileLines[j + 1];
        if (newLine.length + 1 + suffix.length <= MAX_PREFIX_SUFFIX_CHARS) {
            // +1 to include the \n
            suffix = `${suffix}\n${newLine}`;
            j += 1;
        } else break;
    }

    return { prefix, suffix };
};

export const ctrlKStream_userMessage = ({
    selection,
    prefix,
    suffix,
    instructions,
    fimTags,
    isOllamaFIM,
    language,
}) => {
    const { preTag, sufTag, midTag } = fimTags;

    // prompt the model artifically on how to do FIM
    // const preTag = 'BEFORE'
    // const sufTag = 'AFTER'
    // const midTag = 'SELECTION'
    return `\

    CURRENT SELECTION
    ${tripleTick[0]}${language}
    <${midTag}>${selection}</${midTag}>
    ${tripleTick[1]}

    INSTRUCTIONS
    ${instructions}

    <${preTag}>${prefix}</${preTag}>
    <${sufTag}>${suffix}</${sufTag}>

    Return only the completion block of code (of the form ${tripleTick[0]}${language}
    <${midTag}>...new code</${midTag}>
    ${tripleTick[1]}).`;
};

export const ctrlKStream_systemMessage = ({ quickEditFIMTags: { preTag, midTag, sufTag } }) => {
    return `\
    You are a FIM (fill-in-the-middle) coding assistant. Your task is to fill in the middle SELECTION marked by <${midTag}> tags.

    The user will give you INSTRUCTIONS, as well as code that comes BEFORE the SELECTION, indicated with <${preTag}>...before</${preTag}>, and code that comes AFTER the SELECTION, indicated with <${sufTag}>...after</${sufTag}>.
    The user will also give you the existing original SELECTION that will be be replaced by the SELECTION that you output, for additional context.

    Instructions:
    1. Your OUTPUT should be a SINGLE PIECE OF CODE of the form <${midTag}>...new_code</${midTag}>. Do NOT output any text or explanations before or after this.
    2. You may ONLY CHANGE the original SELECTION, and NOT the content in the <${preTag}>...</${preTag}> or <${sufTag}>...</${sufTag}> tags.
    3. Make sure all brackets in the new selection are balanced the same as in the original selection.
    4. Be careful not to duplicate or remove variables, comments, or other syntax by mistake.
`;
};

export class CompletionFormatter {
    formattedCompletion = '';
    currentColumn = 0;
    constructor(completion, currentColumn) {
        this.formattedCompletion = completion;
        this.currentColumn = currentColumn;
    }

    setCompletion(completion) {
        this.formattedCompletion = completion;
        return this;
    }

    removeInvalidLineBreaks() {
        this.formattedCompletion = this.formattedCompletion.trimEnd();
        return this;
    }

    removeMarkdownCodeSyntax() {
        this.formattedCompletion = this.removeMarkdownCodeBlocks(this.formattedCompletion);
        return this;
    }

    indentByColumn() {
        // Split completion into lines
        const lines = this.formattedCompletion.split('\n');

        // Skip indentation if there's only one line or if there's text before cursor in the line
        if (lines.length <= 1) {
            return this;
        }

        // Create indentation string based on current column position
        const indentation = ' '.repeat(this.currentColumn - 1);

        // Keep first line as is, indent all subsequent lines
        this.formattedCompletion =
            lines[0] +
            '\n' +
            lines
                .slice(1)
                .map(line => indentation + line)
                .join('\n');

        return this;
    }

    removeMarkdownCodeBlocks(text) {
        const codeBlockRegex = /```[\s\S]*?```/g;
        let result = text;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            const codeBlock = match[0];
            const codeContent = codeBlock.split('\n').slice(1, -1).join('\n');
            result = result.replace(codeBlock, codeContent);
        }

        return result.trim();
    }

    removeExcessiveNewlines() {
        this.formattedCompletion = this.formattedCompletion.replace(/\n{3,}/g, '\n\n');
        return this;
    }

    build() {
        return this.formattedCompletion;
    }
}
