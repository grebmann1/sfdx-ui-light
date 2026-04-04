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

declare module 'lwr/navigation' {
    export interface PageReference {
        type?: string;
        attributes?: Record<string, string>;
        state?: Record<string, string>;
        [key: string]: unknown;
    }

    export const NavigationContext: any;
    export const CurrentPageReference: any;
    export const CurrentView: any;

    export function navigate(
        context: unknown,
        pageReference: PageReference,
        replace?: boolean
    ): void;
    export function generateUrl(
        context: unknown,
        pageReference: PageReference,
        options?: unknown
    ): string | null;
}

declare module 'lwr/router' {
    export interface PageReference {
        type?: string;
        attributes?: Record<string, string>;
        state?: Record<string, string>;
        [key: string]: unknown;
    }

    export interface RouterConfig<TPageReference = PageReference> {
        routes?: unknown[];
        basePath?: string;
        [key: string]: unknown;
    }

    export interface Router<TPageReference = PageReference> {
        navigate?: (pageReference: TPageReference, replace?: boolean) => void;
        generateUrl?: (pageReference: TPageReference, options?: unknown) => string | null;
        [key: string]: unknown;
    }

    export function createRouter(config?: RouterConfig<PageReference>): Router<PageReference>;
}