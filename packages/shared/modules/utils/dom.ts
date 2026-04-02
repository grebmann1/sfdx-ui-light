/**
 * DOM manipulation utilities
 */

export function enableBodyScroll(): void {
    const body = document.querySelector('body');
    if (body) {
        body.style.overflow = '';
    }
}

export function disableBodyScroll(): void {
    const body = document.querySelector('body');
    if (body) {
        body.style.overflow = 'hidden';
    }
}

export function timeout(interval: number): Promise<void> {
    return new Promise<void>(resolve => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(resolve, interval);
    });
}

export function animationFrame(): Promise<number> {
    return new Promise<number>(resolve => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        window.requestAnimationFrame(resolve);
    });
}
