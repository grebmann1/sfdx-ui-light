// splitView.js
import { LightningElement, track, api } from 'lwc';

export default class SplitView extends LightningElement {

    @api leftMinWidth = 0;
    @api rightMinWidth = 0;

    @track splitterPosition = 50; // Initial position of the splitter (percentage)
    @track isDragging = false;

    // Computed styles for columns and splitter
    get leftColumnStyle() {
        return `width: ${this.splitterPosition}%;`;
    }

    get rightColumnStyle() {
        return `width: calc(${100 - this.splitterPosition}% - 12px);`;
    }

    get splitterStyle() {
        return `left: ${this.splitterPosition}%;`;
    }

    get containerStyle() {
        return this.isDragging ? 'user-select: none;' : '';
    }

    // Handler for mousedown event on splitter
    handleMouseDown = (event) => {
        this.isDragging = true;
        const containerRect = this.template.querySelector('.split-view').getBoundingClientRect();

        const handleMouseMove = (moveEvent) => {
            const left_width = moveEvent.clientX - containerRect.left;
            const right_width = containerRect.width - left_width;
            //console.log('left_width',left_width,right_width);
            if(left_width >= this.leftMinWidth && right_width >= this.rightMinWidth){
                const newSplitterPosition = ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100;
                this.splitterPosition = Math.max(10, Math.min(90, newSplitterPosition)); // Limit position within 10% to 90%
            }
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
