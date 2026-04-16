import { api, track, LightningElement } from 'lwc';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export default class QuestionPrompt extends LightningElement {
    @api questionId: string = '';
    @api question: string = '';
    @api options: string[] = [];

    @track _selectedIndex: number | null = null;
    @track _freeText = '';

    get hasOptions() {
        return Array.isArray(this.options) && this.options.length > 0;
    }

    get formattedOptions() {
        return (Array.isArray(this.options) ? this.options : []).map((value, index) => {
            const isSelected = this._selectedIndex === index;
            return {
                key: `opt-${index}`,
                index,
                label: OPTION_LABELS[index] ?? String(index + 1),
                value,
                isSelected,
                buttonClass: isSelected
                    ? 'question-option-btn question-option-btn-selected'
                    : 'question-option-btn',
            };
        });
    }

    get inputPlaceholder() {
        return this.hasOptions ? 'Or type a custom answer…' : 'Type your answer…';
    }

    get isSubmitDisabled() {
        if (this._selectedIndex !== null) return false;
        return !this._freeText.trim();
    }

    get _currentAnswer() {
        if (this._selectedIndex !== null) {
            const opt = Array.isArray(this.options) ? this.options[this._selectedIndex] : null;
            return opt ?? '';
        }
        return this._freeText.trim();
    }

    handleOptionClick(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        this._selectedIndex = this._selectedIndex === index ? null : index;
        this._freeText = '';
    }

    handleInputChange(event) {
        this._freeText = event.target.value;
        this._selectedIndex = null;
    }

    handleInputKeydown(event) {
        if (event.key === 'Enter' && !this.isSubmitDisabled) {
            this._submit();
        }
        if (event.key === 'Escape') {
            this._skip();
        }
    }

    handleSubmit() {
        this._submit();
    }

    handleSkip() {
        this._skip();
    }

    _submit() {
        const answer = this._currentAnswer;
        if (!answer) return;
        this.dispatchEvent(
            new CustomEvent('questionanswered', {
                detail: { id: this.questionId, answer },
                bubbles: true,
            })
        );
    }

    _skip() {
        this.dispatchEvent(
            new CustomEvent('questionanswered', {
                detail: { id: this.questionId, answer: '' },
                bubbles: true,
            })
        );
    }
}
