import { LightningElement, track, api } from 'lwc';

export default class installSteps extends LightningElement {
    @api redirect_url;
    @track currentStepIndex = 0;
    @track steps = [
        {
            id: 0,
            class: 'slds-dot slds-dot_active',
            title: 'Pin the Extension for Quick Access',
            description:
                'For the best experience, pin the Salesforce Toolkit extension to your browser toolbar. </br> Click the puzzle icon (Extensions), then click the pin next to Salesforce Toolkit. Once pinned, click the extension icon to open it and view your credentials instantly.',
            image: 'https://res.cloudinary.com/dh6amy4y7/image/upload/v1746650482/extension_pin_el3z6q.gif',
        },
        {
            id: 1,
            class: 'slds-dot',
            title: 'How to Open the Toolkit',
            description:
                'To get started, open the Salesforce Toolkit by clicking the extension icon in your browser toolbar. You can also use the keyboard shortcut shown below. Watch the animation for a quick demonstration.',
            image: 'https://res.cloudinary.com/dh6amy4y7/image/upload/v1746650483/extension_open_dnyzov.gif',
        },
        {
            id: 2,
            class: 'slds-dot',
            title: 'Register & Login to a Salesforce Org Instantly',
            description: `Add a new Salesforce org and log in with just a few clicks! Click the "+" button in the extension, follow the prompts, and you'll be connected in seconds.</br> For some orgs with strong security settings, you may be redirected to the Salesforce login page to complete authentication.</br> This is normal and ensures your org's security policies are respected.`,
            image: 'https://res.cloudinary.com/dh6amy4y7/image/upload/v1746650485/extension_addNewOrg_rl0i2e.gif',
        },
        {
            id: 3,
            class: 'slds-dot',
            title: 'Edit Records Instantly',
            description:
                'Easily and quickly edit any Salesforce record directly from the page you are viewing.</br> No need to navigate away, just open the toolkit, make your changes, and save instantly.',
            image: 'https://res.cloudinary.com/dh6amy4y7/image/upload/v1746650483/extension_quickEdit_yoih4b.gif',
        },
        {
            id: 4,
            class: 'slds-dot',
            title: 'Query & Export Data Effortlessly',
            description:
                'With Salesforce Toolkit, you can easily query and export your Salesforce data in just a few clicks. Use the built-in SOQL editor to run queries and export results to CSV. </br> You can even set up a custom shortcut for quick access to the query tool directly from the settings!',
            image: 'https://res.cloudinary.com/dh6amy4y7/image/upload/v1746650484/extension_openDB_gbt42k.gif',
        },
        {
            id: 5,
            class: 'slds-dot',
            title: 'Explore APIs Instantly',
            description:
                "The API Explorer lets you discover and interact with Salesforce APIs directly from your browser.</br>No authentication required!</br> Instantly see available endpoints, try out requests, and understand your org's API capabilities with ease.",
            image: 'https://res.cloudinary.com/dh6amy4y7/image/upload/v1746650486/extension_apiExplorer_d7kb2z.gif',
        },
        {
            id: 6,
            class: 'slds-dot',
            title: 'Run Anonymous Apex Code',
            description:
                'Use the Anonymous Apex Module to quickly test and execute Apex code snippets in your org. Perfect for developers and admins who want to experiment or troubleshoot without deploying code.',
            image: 'https://res.cloudinary.com/dh6amy4y7/image/upload/v1746650484/extension_apexScript_x77qhm.gif',
        },
        {
            id: 7,
            class: 'slds-dot',
            title: 'Customize Content Script Injection (Advanced)',
            description: `You can control exactly where the Salesforce Toolkit injects its features by editing the include/exclude URL patterns in the extension settings. Use regular expressions to match or exclude specific Salesforce pages or environments. This is useful for advanced users who want fine-grained control over the extension's behavior.`,
            image: 'https://res.cloudinary.com/dh6amy4y7/image/upload/v1746650484/extension_customContentScriptRegex_u0lthu.gif',
        },
        {
            id: 8,
            class: 'slds-dot',
            title: 'Ready to Go!',
            description: `You\'re all set to start using Salesforce Toolkit. </br> The extension will automatically activate when you visit Salesforce pages.</br> </br>If you have more questions or want to contribute, visit our GitHub page: <a href="https://github.com/grebmann1/sfdx-ui-light" target="_blank">https://github.com/grebmann1/sfdx-ui-light</a>`,
            list: [
                'Need help? Visit our documentation or contact support through the extension settings.',
            ],
        },
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
            class: index === this.currentStepIndex ? 'slds-dot slds-dot_active' : 'slds-dot',
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

    handleStepMenuClick(event) {
        const index = parseInt(event.currentTarget.dataset.stepIndex, 10);
        if (!isNaN(index)) {
            this.currentStepIndex = index;
            this.updateStepIndicator();
        }
    }

    get stepMenuClasses() {
        return this.steps.map((step, index) => {
            let base = 'onboarding-step-list-item';
            let active = this.currentStepIndex === index ? 'onboarding-step-active' : '';
            return `${base} ${active}`.trim();
        });
    }

    get formattedSteps() {
        return this.steps.map((step, index) => ({
            ...step,
            class: this.stepMenuClasses[index],
        }));
    }
}
