import { api, track, LightningElement } from 'lwc';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export default class QuestionPrompt extends LightningElement {
    @api questionId: string = '';
    @api question: string = '';
    @api options: string[] = [];

    @track _selectedIndex: number | null = null;
    @track _otherSelected: boolean = false;
    @track _otherText: string = '';

    get formattedOptions() {
        return (Array.isArray(this.options) ? this.options : []).map((value, index) => {
            const isSelected = !this._otherSelected && this._selectedIndex === index;
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

    get otherLabel() {
        const count = Array.isArray(this.options) ? this.options.length : 0;
        return OPTION_LABELS[count] ?? String(count + 1);
    }

    get otherButtonClass() {
        return this._otherSelected
            ? 'question-option-btn question-option-btn-selected'
            : 'question-option-btn';
    }

    get isSubmitDisabled() {
        if (this._otherSelected) {
            return !this._otherText.trim();
        }
        return this._selectedIndex === null;
    }

    handleOptionClick(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        this._otherSelected = false;
        this._selectedIndex = this._selectedIndex === index ? null : index;
    }

    handleOtherClick() {
        this._otherSelected = !this._otherSelected;
        if (this._otherSelected) {
            this._selectedIndex = null;
        }
    }

    handleOtherInput(event) {
        this._otherText = event.target.value;
    }

    handleKeydown(event) {
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
        let answer: string;
        if (this._otherSelected) {
            answer = this._otherText.trim();
        } else {
            if (this._selectedIndex === null) return;
            answer = Array.isArray(this.options) ? this.options[this._selectedIndex] : '';
        }
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
