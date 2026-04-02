declare const chrome: any;
declare const browser: any;

interface Window {
    defaultStore?: any;
    jsforce?: any;
    electron?: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
    sessionId?: string;
    serverUrl?: string;
    UserContext?: {
        userId?: string;
    };
    $A?: {
        get?: (key: string) => string | undefined;
    };
}

declare module 'connection/*';
declare module 'core/*';
declare module 'extension/*';
declare module 'feature/*';
declare module 'overlay/*';
declare module 'panels/*';
declare module 'views/*';

declare module 'imported/jsforce';
declare module 'localforage';
declare module 'moment';
declare module 'slds/hashtagDropdown';
declare module 'smartinput/utils';
declare module 'lightning/toast';
declare module 'lightning/modal';
declare module 'editor/promptWidget';

declare module 'lwc' {
    export class LightningElement {
        dispatchEvent: (event: Event) => boolean;
        template: any;
        refs?: Record<string, Element>;
    }
    export const api: any;
    export const track: any;
    export const createElement: any;
    export const wire: any;
}
