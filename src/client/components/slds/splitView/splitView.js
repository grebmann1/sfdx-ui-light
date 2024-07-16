// splitView.js
import { LightningElement, track, api } from 'lwc';
import { classSet } from 'lightning/utils';

export default class SplitView extends LightningElement {

    @api leftMinWidth = 0;
    @api rightMinWidth = 0;
    @api topMinHeight = 0;
    @api bottomMinHeight = 0;
    @api isHorizontal = false; // true for horizontal split, false for vertical split

    @api splitterPosition = 50; // Initial position of the splitter (percentage)
    @track isDragging = false;

    // Computed styles for columns and splitter
    get leftColumnStyle() {
        return this.isHorizontal ? `width: ${this.splitterPosition}%;` : `height: ${this.splitterPosition}%;`;
    }

    get rightColumnStyle() {
        return this.isHorizontal ? `width: calc(${100 - this.splitterPosition}% - 12px);` : `height: calc(${100 - this.splitterPosition}% - 12px);`;
    }

    get splitterStyle() {
        return this.isHorizontal ? `left: ${this.splitterPosition}%;` : `top: ${this.splitterPosition}%;`;
    }

    get containerStyle() {
        return this.isDragging ? 'user-select: none;' : '';
    }

    get viewDirection() {
        return this.isHorizontal ? 'split-view horizontal' : 'split-view vertical';
    }

    get separatorDirection() {
        return this.isHorizontal ? 'separator-horizontal' : 'separator-vertical';
    }

    get splitViewClass(){
        return classSet('split-view').add(this.viewDirection).toString();
    }

    get splitViewColumnClass(){
        return classSet('split-view-column').add(this.viewDirection).toString();
    }

    get splitterClass(){
        return classSet('splitter').add(this.separatorDirection)
        .add({
            'vertical-splitter':!this.isHorizontal,
            'horizontal-splitter':this.isHorizontal
        })
        .toString();
    }

    // Handler for mousedown event on splitter
    handleMouseDown = (event) => {
        this.isDragging = true;
        const containerRect = this.template.querySelector('.split-view').getBoundingClientRect();

        const handleMouseMove = (moveEvent) => {
            if (this.isHorizontal) {
                const left_width = moveEvent.clientX - containerRect.left;
                const right_width = containerRect.width - left_width;
                if (left_width >= this.leftMinWidth && right_width >= this.rightMinWidth) {
                    const newSplitterPosition = ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100;
                    this.splitterPosition = Math.max(10, Math.min(90, newSplitterPosition)); // Limit position within 10% to 90%
                }
            } else {
                const top_height = moveEvent.clientY - containerRect.top;
                const bottom_height = containerRect.height - top_height;
                if (top_height >= this.topMinHeight && bottom_height >= this.bottomMinHeight) {
                    const newSplitterPosition = ((moveEvent.clientY - containerRect.top) / containerRect.height) * 100;
                    this.splitterPosition = Math.max(10, Math.min(90, newSplitterPosition)); // Limit position within 10% to 90%
                }
            }
            window.dispatchEvent(new Event('resize'));
        };

        const handleMouseUp = () => {
            this.isDragging = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
}
