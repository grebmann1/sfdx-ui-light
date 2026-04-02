declare module 'lwc' {
    export class LightningElement {
        dispatchEvent: (event: Event) => boolean;
        template: any;
        refs?: Record<string, Element>;
    }
    export const api: any;
    export const track: any;
    export const wire: any;
    export const createElement: any;
}

declare module 'lightning/*';
declare module 'slds/*';
declare module 'localforage';
declare module 'moment';
declare module 'smartinput/utils';