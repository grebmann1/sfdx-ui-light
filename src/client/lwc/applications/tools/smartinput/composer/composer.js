import { api, LightningElement, track } from 'lwc';
import { fetchCompletion, ROLES } from 'ai/utils';

import { isMac } from 'shared/utils';

export default class Composer extends LightningElement {
    @api isLoading = false;
    @api isEnhanceEnabled = false;
    @track _value = '';
    @track isEnhancing = false;

    @api
    get value() {
        return this._value;
    }
    set value(v) {
        this._value = v || '';
    }

    focusInput() {
        const ta = this.template.querySelector('textarea');
        ta && ta.focus();
    }

    handleInput = (e) => {
        this._value = e.target.value;
    };

    handleKeyDown = async (e) => {
        const cmdPressed = isMac() ? !!e.metaKey : !!e.ctrlKey;
        if (cmdPressed && e.key === 'Enter') {
            e.preventDefault();
            if (this.isEnhanceEnabled && !this.isEnhancing) {
                await this.handleEnhance();
            }
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSave();
        }
    };

    handleReset = () => {
        this._value = '';
        const ta = this.template.querySelector('textarea');
        if (ta) ta.value = '';
        this.dispatchEvent(new CustomEvent('reset'));
    };

    handleSave = () => {
        const trimmed = (this._value || '').trim();
        if (!trimmed) return;
        this.dispatchEvent(new CustomEvent('createitems', { detail: { items: [trimmed] } }));
        this._value = '';
        const ta = this.template.querySelector('textarea');
        if (ta) ta.value = '';
    };

    handleEnhance = async () => {
        const trimmed = (this._value || '').trim();
        if (!trimmed || !this.isEnhanceEnabled) return;
        this.isEnhancing = true;
        try {
            const suggestions = await this.generateSuggestions(trimmed);
            if (!suggestions || suggestions.length === 0) return;
            if (suggestions.length === 1) {
                this._value = suggestions[0];
            } else {
                this.dispatchEvent(new CustomEvent('createitems', { detail: { items: suggestions } }));
                this._value = '';
                const ta = this.template.querySelector('textarea');
                if (ta) ta.value = '';
            }
        } finally {
            this.isEnhancing = false;
        }
    };

    async generateSuggestions(promptText) {
        try {
            const response_format = {
                type: 'json_schema',
                json_schema: {
                    name: 'smartinput_values',
                    schema: {
                        type: 'object',
                        properties: {
                            items: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
                        },
                        required: ['items'],
                        additionalProperties: false,
                    },
                    strict: true,
                },
            };
            const messages = [
                { role: ROLES.SYSTEM, content: `
                    You are Smart Input Assistant. 
                    Produce realistic, concise values suitable for Form inputs. 
                    <Important>
                        If the user asks for multiple, return several otherwise ONLY return one. 
                    </Important>
                    Do not include labels or explanations.
                ` },
                { role: ROLES.USER, content: promptText },
            ];
            const data = await fetchCompletion({ model: 'gpt-4o-mini', messages, response_format });
            const content = data?.choices?.[0]?.message?.content || '';
            try {
                const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                const items = Array.isArray(parsed?.items) ? parsed.items : [];
                return items.map(v => (v || '').toString().trim()).filter(Boolean);
            } catch (_) {
                const lines = content.split('\n').map(x => x.trim()).filter(Boolean);
                return lines;
            }
        } catch (e) {
            return null;
        }
    }
}


