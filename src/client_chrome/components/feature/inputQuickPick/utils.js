export const isMac = () => navigator.platform.toUpperCase().indexOf('MAC') >= 0;

export const isTextInputLike = (el) => {
    if (!el) return false;
    const tag = el.tagName;
    const type = (el.getAttribute && el.getAttribute('type')) || '';
    return (
        (tag === 'INPUT' && ['text', 'email', 'number', 'search', 'tel', 'url', 'password'].includes(type)) ||
        tag === 'TEXTAREA' ||
        el.isContentEditable === true
    );
}

export const positionFor = (target, containerEl) => {
    const rect = target.getBoundingClientRect();
    const margin = 6;
    // Container measurements (fallbacks if not rendered yet)
    const containerWidth = (containerEl && containerEl.offsetWidth) || 320;
    const containerHeight = (containerEl && containerEl.offsetHeight) || 160;

    // Horizontal
    let left = rect.left;
    if (left + containerWidth > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - containerWidth);
    }

    // Vertical: prefer below if enough space, otherwise above
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    let top = rect.bottom + margin;
    if (spaceBelow < containerHeight && spaceAbove > containerHeight) {
        top = rect.top - containerHeight - margin;
    }

    // Clamp to viewport
    top = Math.max(margin, Math.min(top, window.innerHeight - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - margin));

    
    if (containerEl) {
        containerEl.style.top = `${top}px`;
        containerEl.style.left = `${left}px`;
    }

    return { top, left };
}