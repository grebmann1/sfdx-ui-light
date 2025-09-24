const Constants = {
    ERROR_MESSAGE_DEFAULT: 'An error occurred with this message.',
    TOAST_CLIPBOARD_LABEL: 'Message exported to your clipboard',
    TOOL_RUNNING_TITLE: 'Calling function',
    TOOL_FINISHED_TITLE: 'Called function',
    TOOL_RESPONSE_SHOW: 'Show Tool Response',
    TOOL_RESPONSE_HIDE: 'Hide Tool Response',
    TOOL_PARAMS_SHOW: 'Show Tool Parameters',
    TOOL_PARAMS_HIDE: 'Hide Tool Parameters',
    TOOL_ICON_PREVIEW: 'utility:preview',
    TOOL_ICON_HIDE: 'utility:hide',
    SENDER_USER: 'You',
    SENDER_ASSISTANT: 'Assistant',
    SCROLL_THRESHOLD: 5,
    WELCOME_MESSAGE: {
        role: 'assistant',
        content: 'Hello, I am the SF Toolkit Assistant, I can help you interact with Salesforce and Salesforce tools.',
        id: 'WELCOME_MESSAGE_ID',
    },
    CONTENT_TYPE: {
        INPUT_TEXT:   "input_text",
        OUTPUT_TEXT:  "output_text",
        INPUT_IMAGE:  "input_image",
        INPUT_FILE:   "input_file",
    }
};

export default Constants;
