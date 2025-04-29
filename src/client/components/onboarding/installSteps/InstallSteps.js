import { LightningElement, track } from 'lwc';

export default class installSteps extends LightningElement {
    @track currentStepIndex = 0;
    @track steps = [
        {
            id: 1,
            class: 'slds-dot slds-dot_active',
            title: 'How to Open the Toolkit',
            description: 'To get started, open the Salesforce Toolkit by clicking the extension icon in your browser toolbar. You can also use the keyboard shortcut shown below. Watch the animation for a quick demonstration.',
            image: '/gifs/extension_open.gif'
        },
        {
            id: 2,
            class: 'slds-dot',
            title: 'Edit Records Instantly',
            description: 'Easily and quickly edit any Salesforce record directly from the page you are viewing. No need to navigate away—just open the toolkit, make your changes, and save instantly.',
            image: '/gifs/extension_quickEdit.gif'
        },
        {
            id: 3,
            class: 'slds-dot',
            title: 'Query & Export Data Effortlessly',
            description: 'With Salesforce Toolkit, you can easily query and export your Salesforce data in just a few clicks. Use the built-in SOQL editor to run queries and export results to CSV. You can even set up a custom shortcut for quick access to the query tool directly from the settings!',
            image: '/gifs/extension_openDB.gif'
        },
        {
            id: 4,
            class: 'slds-dot',
            title: 'Explore APIs Instantly',
            description: 'The API Explorer lets you discover and interact with Salesforce APIs directly from your browser—no authentication required! Instantly see available endpoints, try out requests, and understand your org\'s API capabilities with ease.',
            image: '/gifs/extension_apiExplorer.gif'
        },
        {
            id: 5,
            class: 'slds-dot',
            title: 'Run Anonymous Apex Code',
            description: 'Use the Anonymous Apex Module to quickly test and execute Apex code snippets in your org. Perfect for developers and admins who want to experiment or troubleshoot without deploying code.',
            image: '/gifs/extension_apexScript.gif'
        },
        {
            id: 6,
            class: 'slds-dot',
            title: 'Ready to Go!',
            description: `You\'re all set to start using Salesforce Toolkit. The extension will automatically activate when you visit Salesforce pages.\n\nIf you have more questions or want to contribute, visit our GitHub page: <a href="https://github.com/grebmann1/sfdx-ui-light" target="_blank">https://github.com/grebmann1/sfdx-ui-light</a>`,
            list: [
                'Need help? Visit our documentation or contact support through the extension settings.'
            ]
        }
    ];

    get currentStep() {
        return this.steps[this.currentStepIndex];
    }

    get isFirstStep() {
        return this.currentStepIndex === 0;
    }

    get isLastStep() {
        return this.currentStepIndex === this.steps.length - 1;
    }

    get nextButtonText() {
        return this.isLastStep ? 'Get Started' : 'Next';
    }

    handleNext() {
        if (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex++;
            this.updateStepIndicator();
        } else {
            this.closeTutorial();
        }
    }

    handlePrevious() {
        if (this.currentStepIndex > 0) {
            this.currentStepIndex--;
            this.updateStepIndicator();
        }
    }

    handleSkip() {
        this.closeTutorial();
    }

    updateStepIndicator() {
        this.steps = this.steps.map((step, index) => ({
            ...step,
            class: index === this.currentStepIndex ? 'slds-dot slds-dot_active' : 'slds-dot'
        }));
    }

    closeTutorial() {
        // Store that the user has seen the tutorial
        localStorage.setItem('hasSeenTutorial', 'true');
        
        // Dispatch event to parent component
        this.dispatchEvent(new CustomEvent('tutorialcomplete'));
    }

    connectedCallback() {
        // Add keyboard navigation
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    disconnectedCallback() {
        // Remove keyboard navigation
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleKeyDown(event) {
        if (event.key === 'ArrowRight' && !this.isLastStep) {
            this.handleNext();
        } else if (event.key === 'ArrowLeft' && !this.isFirstStep) {
            this.handlePrevious();
        } else if (event.key === 'Escape') {
            this.handleSkip();
        }
    }
} 