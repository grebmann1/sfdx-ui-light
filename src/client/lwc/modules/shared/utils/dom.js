/**
 * DOM manipulation utilities
 */

export function enableBodyScroll() {
    document.querySelector('body').style.overflow = '';
}

export function disableBodyScroll() {
    document.querySelector('body').style.overflow = 'hidden';
}

export function timeout(interval) {
    return new Promise(resolve => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(resolve, interval);
    });
}

export function animationFrame() {
    return new Promise(resolve => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        window.requestAnimationFrame(resolve);
    });
}
