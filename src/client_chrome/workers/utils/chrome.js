const PING_TIMEOUT_MS = 300;
export async function injectContentScript(
    tabId,
    files,
    injectImmediately = false,
    world = 'ISOLATED',
) {
    console.log(`Injecting ${files.join(', ')} into tab ${tabId}`);

    // check if script is already injected
    try {
        const response = await Promise.race([
            chrome.tabs.sendMessage(tabId, { action: `${this.name}_ping` }),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error(`${this.name} Ping action to tab ${tabId} timed out`)),
                    PING_TIMEOUT_MS,
                ),
            ),
        ]);

        if (response && response.status === 'pong') {
            console.log(
                `pong received for action '${this.name}' in tab ${tabId}. Assuming script is active.`,
            );
            return;
        } else {
            console.warn(`Unexpected ping response in tab ${tabId}:`, response);
        }
    } catch (error) {
        console.error(
            `ping content script failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files,
            injectImmediately,
            world,
        });
        console.log(`'${files.join(', ')}' injection successful for tab ${tabId}`);
    } catch (injectionError) {
        const errorMessage =
            injectionError instanceof Error ? injectionError.message : String(injectionError);
        console.error(
            `Content script '${files.join(', ')}' injection failed for tab ${tabId}: ${errorMessage}`,
        );
        throw new Error(
            `Failed to inject content script in tab ${tabId}: ${errorMessage}`,
        );
    }
}

export async function sendMessageToTab(tabId, message) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, message);

        if (response && response.error) {
            throw new Error(String(response.error));
        }

        return response;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
            `Error sending message to tab ${tabId} for action ${message?.action || 'unknown'}: ${errorMessage}`,
        );

        if (error instanceof Error) {
            throw error;
        }
        throw new Error(errorMessage);
    }
}

export const TOOL_MESSAGE_TYPES = {
    // Screenshot related
    SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE: 'preparePageForCapture',
    SCREENSHOT_GET_PAGE_DETAILS: 'getPageDetails',
    SCREENSHOT_GET_ELEMENT_DETAILS: 'getElementDetails',
    SCREENSHOT_SCROLL_PAGE: 'scrollPage',
    SCREENSHOT_RESET_PAGE_AFTER_CAPTURE: 'resetPageAfterCapture',

    // Web content fetching
    WEB_FETCHER_GET_HTML_CONTENT: 'getHtmlContent',
    WEB_FETCHER_GET_TEXT_CONTENT: 'getTextContent',

    // User interactions
    CLICK_ELEMENT: 'clickElement',
    FILL_ELEMENT: 'fillElement',
    SIMULATE_KEYBOARD: 'simulateKeyboard',

    // Interactive elements
    GET_INTERACTIVE_ELEMENTS: 'getInteractiveElements',

    // Network requests
    NETWORK_SEND_REQUEST: 'sendPureNetworkRequest',

    // Semantic similarity engine
    SIMILARITY_ENGINE_INIT: 'similarityEngineInit',
    SIMILARITY_ENGINE_COMPUTE_BATCH: 'similarityEngineComputeBatch',
};