# Command+K Prompt Editor: Design & Implementation Plan

## Overview

This document describes the design and implementation plan for a new feature: a hidden component injected into every page of the application, which listens for the "Command + K" keyboard shortcut. When triggered, it displays a prompt editor modal, allowing users to quickly enter, edit, or analyze text. The editor can pre-fill with clipboard contents and will support various text-processing actions.

---

## Goals

- **Universal Access:** The editor should be accessible from any page via "Command + K".
- **Quick Text Manipulation:** Allow users to rapidly edit, analyze, or transform text.
- **Clipboard Integration:** Optionally pre-fill the editor with clipboard contents.
- **Extensible Actions:** Support for running custom actions (e.g., formatting, AI analysis, etc.) on the input text.
- **Non-intrusive:** The component should remain hidden until activated.

---

## Technical Approach

### 1. Component Technology

- **LWC (Lightning Web Components):** Preferred for consistency with the existing codebase.
- **ReactJS:** Could be considered if LWC presents limitations, but LWC is recommended for seamless integration.

### 2. Component Injection

- **Global Registration:** The component should be registered at the root level (e.g., in the main app shell or a global layout component) to ensure it is present on every page.
- **Hidden by Default:** The component remains invisible and does not interfere with page layout or performance.

### 3. Keyboard Shortcut Listener

- **Event Listener:** Add a global event listener for "keydown" events, specifically for "Command + K" (Mac) or "Ctrl + K" (Windows/Linux).
- **Debounce/Prevent Default:** Ensure the shortcut does not conflict with browser or app-level shortcuts.

### 4. Modal Prompt Editor

- **Modal UI:** Use an LWC modal (e.g., based on `lightning-modal` or the existing `modalLauncher`) to display the editor.
- **Text Area/Input:** Provide a multi-line text area for user input.
- **Clipboard Integration:** On open, attempt to read from the clipboard and pre-fill the editor if content is available.
- **Action Buttons:** Include buttons for "Run", "Copy Output", "Close", etc.

### 5. Text Processing Actions

- **Pluggable Actions:** Design the editor to support multiple actions (e.g., format, analyze, summarize, etc.).
- **Async Support:** Allow actions to be asynchronous (e.g., call an API or AI service).

### 6. Output Handling

- **Display Output:** Show the result of the action in the modal.
- **Clipboard Support:** Allow users to copy the output back to the clipboard.

---

## Implementation Steps

1. **Create the LWC Component**
   - Name: `ui-commandKPromptEditor`
   - Hidden by default; listens for the keyboard shortcut.

2. **Global Injection**
   - Add the component to the root app template (e.g., in `ui/root` or equivalent).

3. **Keyboard Shortcut Handling**
   - Add event listeners in the component's lifecycle hooks.
   - Ensure proper cleanup on component unmount.

4. **Modal Editor UI**
   - Use or extend the existing modal infrastructure (`modalLauncher`).
   - Build the editor UI with a textarea and action buttons.

5. **Clipboard Integration**
   - Use the Clipboard API to read/paste content on modal open.

6. **Action Framework**
   - Define a set of actions (format, analyze, etc.) as pluggable modules.

7. **Testing**
   - Test on all supported browsers and platforms.
   - Ensure no conflicts with existing shortcuts.

---

## Potential Enhancements

- **Customizable Shortcuts:** Allow users to configure the activation shortcut.
- **History:** Store previous prompts and outputs for quick reuse.
- **AI Integration:** Integrate with AI services for advanced text analysis or transformation.

---

## References

- Existing modal components: `ui/modalLauncher`
- UI patterns: `ui/launcher`, `ui/menu`
- Clipboard API: [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)

---

**Next Steps:**
- Approve this plan and create the initial LWC component scaffold.
- Integrate with the modal system and implement the keyboard shortcut logic. 