export class StreamParser {
    constructor(startTag, endTag) {
        this.startTag = startTag;
        this.endTag = endTag;
        this.buffer = '';
        this.state = 'lookingForStart'; // or 'collecting'
        this.result = '';
    }

    is(chunk) {
        this.buffer += chunk;

        while (this.buffer.length > 0) {
            if (this.state === 'lookingForStart') {
                const startIdx = this.buffer.indexOf(this.startTag);

                if (startIdx !== -1) {
                    // Found start tag
                    this.buffer = this.buffer.slice(startIdx + this.startTag.length);
                    this.state = 'collecting';
                } else {
                    // Not found, but tag might be incomplete
                    const possibleTagStart = this._possibleTag(this.startTag);
                    if (possibleTagStart) {
                        // Keep only the part that might be part of the start tag
                        this.buffer = possibleTagStart;
                    } else {
                        // No match at all, clear buffer
                        this.buffer = '';
                    }
                    break;
                }
            } else if (this.state === 'collecting') {
                const endIdx = this.buffer.indexOf(this.endTag);

                if (endIdx !== -1) {
                    // Found end tag
                    this.result += this.buffer.slice(0, endIdx);
                    this.buffer = this.buffer.slice(endIdx + this.endTag.length);
                    this.state = 'lookingForStart';
                    break; // one block captured
                } else {
                    // No end tag yet, might be incomplete
                    const possibleTagStart = this._possibleTag(this.endTag);
                    if (possibleTagStart) {
                        // Capture everything except possible end tag
                        const captureLength = this.buffer.length - possibleTagStart.length;
                        this.result += this.buffer.slice(0, captureLength);
                        this.buffer = this.buffer.slice(captureLength);
                    } else {
                        // No end tag in sight
                        this.result += this.buffer;
                        this.buffer = '';
                    }
                    break;
                }
            }
        }
    }

    _possibleTag(tag) {
        // Check if buffer ends with a partial match of the given tag
        for (let i = 1; i < tag.length; i++) {
            if (tag.startsWith(this.buffer.slice(-i))) {
                return this.buffer.slice(-i);
            }
        }
        return null;
    }

    getResult() {
        return this.result;
    }
}
