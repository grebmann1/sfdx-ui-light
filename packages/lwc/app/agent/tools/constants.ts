export const SHELL_TOOL_HELP = {
    js: `Execute JavaScript in the sandbox with Puppeteer browser automation and filesystem access.
Use 'return' to get a result back.

Usage:
  js -e '<code>'              Inline code (like node -e)
  js <file>                    Run a script file from the filesystem
  js --timeout 30000 -e '...'  Custom timeout (default: 10000ms)
  js --help                    Show this help

Available globals: connectToPage(tabId), getSnapshot(page), getElementByRef(page, ref), clearInput(handle),
readFile(path), writeFile(path), listFiles(path), bash(command), logImage(base64), workspace.status(), etc.`,
    saveSkill: `Save a skill to the workspace.

Usage:
  save-skill --name <name> --description "<desc>" --content "<body>"
  save-skill --name <name> --description "<desc>" --file <path>
  save-skill --name <name> --description "<desc>" --content @<path>
  save-skill --name <name> --description "<desc>" --file <path> --scope user --overwrite

Notes:
  - name must be letters, numbers, hyphens, or underscores.
  - content is the SKILL.md body (frontmatter is added automatically).
  - scope defaults to project (saved under /workspace/skills).`,
    bashIntro: 'Execute bash commands in the sandbox environment.',
    useRelativePaths: 'Use relative paths from here.',
    availableFilesLabel: 'Available files:',
    customCommands:
        "Custom commands: js -e '<code>', js <file>, open <file>, save-skill, sf apex run, sf data query, sf api request, sf org list, sf org open",
    sfCliShimsHelp: 'SF CLI shims help:',
} as const;

export const TOOL_OUTPUT_LIMITS = {
    maxChars: 30000,
    tailChars: 2000,
    directory: '/tmp/tool-outputs',
    truncatedMarker: '[OUTPUT TRUNCATED]',
    pageSize: 200,
    sectionSeparator: '\n\n',
    sectionContentSeparator: '\n',
    existingCapSlackChars: 1024,
} as const;

export const SKILL_PATH_TEMPLATES = [
    '/workspace/skills/custom-skills/{name}/SKILL.md',
    '/workspace/.cursor/skills/{name}/SKILL.md',
    '/workspace/skills/{name}/SKILL.md',
    '/workspace/skills/professional/{name}/SKILL.md',
    '/workspace/skills/general/{name}.SKILL.md',
] as const;

export const MODEL_FAMILY_TOOL_TYPES = {
    'gpt-5-mini': ['web_search', 'web_search_preview', 'code_interpreter', 'file_search', 'mcp'],
    'gpt-5-nano': ['web_search', 'web_search_preview', 'code_interpreter', 'file_search', 'mcp'],
    'gpt-5': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'file_search',
        'mcp',
    ],
    'gpt-5-codex': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'file_search',
        'mcp',
    ],
    'gpt-5.2': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'file_search',
        'mcp',
    ],
    'gpt-5.4': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'shell',
        'computer_use_preview',
        'tool_search',
        'apply_patch',
        'file_search',
        'skills',
        'mcp',
    ],
    'gpt-4.1': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'file_search',
        'mcp',
    ],
    'gpt-4.1-mini': ['web_search', 'web_search_preview', 'code_interpreter', 'file_search', 'mcp'],
    'gpt-4.1-nano': ['web_search', 'web_search_preview', 'code_interpreter', 'file_search', 'mcp'],
    'gpt-4o': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'file_search',
        'mcp',
    ],
    o1: ['web_search', 'web_search_preview', 'code_interpreter', 'image_generation', 'file_search', 'mcp'],
    'o1-mini': ['web_search', 'web_search_preview', 'code_interpreter', 'file_search', 'mcp'],
    'o1-pro': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'shell',
        'computer_use_preview',
        'tool_search',
        'apply_patch',
        'file_search',
        'skills',
        'mcp',
    ],
    o3: [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'shell',
        'computer_use_preview',
        'tool_search',
        'apply_patch',
        'file_search',
        'skills',
        'mcp',
    ],
    'o3-mini': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'file_search',
        'mcp',
    ],
    'o3-pro': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'shell',
        'computer_use_preview',
        'tool_search',
        'apply_patch',
        'file_search',
        'skills',
        'mcp',
    ],
    'o4-mini': [
        'web_search',
        'web_search_preview',
        'code_interpreter',
        'image_generation',
        'file_search',
        'mcp',
    ],
} as const;

export const OPENAI_BUILT_IN_TOOLS = [
    {
        type: 'hosted_tool',
        name: 'web_search_preview',
        providerData: {
            type: 'web_search',
            search_context_size: 'medium',
        },
    },
    {
        type: 'hosted_tool',
        name: 'code_interpreter',
        providerData: {
            type: 'code_interpreter',
            container: { type: 'auto' },
        },
    },
    {
        type: 'hosted_tool',
        name: 'image_generation',
        providerData: {
            type: 'image_generation',
        },
    },
    {
        type: 'hosted_tool',
        name: 'shell',
        providerData: {
            type: 'shell',
        },
    },
    {
        type: 'hosted_tool',
        name: 'computer_use_preview',
        providerData: {
            type: 'computer_use_preview',
            environment: 'browser',
            display_width: 1280,
            display_height: 720,
        },
    },
    {
        type: 'hosted_tool',
        name: 'tool_search',
        providerData: {
            type: 'tool_search',
        },
    },
    {
        type: 'hosted_tool',
        name: 'apply_patch',
        providerData: {
            type: 'apply_patch',
        },
    },
] as const;

export const AGENT_TOOL_CONFIG = {
    requestContinue: {
        name: 'agent_request_continue',
        description:
            "Call this when the user's goal is not yet achieved and you need to run more tools in a follow-up turn. Do not call when you can give a final answer. After calling, the run will continue automatically with another turn.",
        reasonDescription: 'Brief reason for continuing (e.g. "Need to run SOQL then Apex")',
        continueWithReasonPrefix: 'Continue with the next steps: ',
        continueWithoutReason: 'Continue with the next steps.',
    },
    askUser: {
        name: 'ask_user',
        description: `Ask the user a clarifying question before proceeding.
Use this tool when you need more information or a decision from the user to complete the task correctly.
Provide clear answer options when the choices are bounded; omit options for open-ended questions.
Wait for the user's answer before continuing.`,
        questionDescription: 'The question to present to the user.',
        optionsDescription:
            'Optional list of predefined answer choices shown as selectable options. Omit for open-ended questions.',
        skippedAnswer: 'The user skipped this question.',
        answerPrefix: "User's answer: ",
    },
} as const;

export const TOOL_APP_NAMES = {
    apex: 'anonymousapex',
    api: 'api',
    metadata: 'metadata',
    soql: 'soql',
} as const;

export const APEX_TOOL_DESCRIPTIONS = {
    navigate: 'Navigate to the Apex Editor application.',
    openTab: 'Open a specific Apex tab in the Apex Editor.',
    execute:
        'Execute anonymous Apex script from the Apex Editor (Based on a selected tab). Ask for confirmation before executing this tool.',
    executeTabId:
        'Tab ID to reuse when the tool is called again with the same context/request',
    edit: 'Create or edit an Apex script in the Apex Editor. \nCall this tool when you need to create or edit an Apex script.',
    editTabId:
        'Optional tab ID to reuse when the tool is called again with the same context/request',
    savedScripts:
        'Fetch saved Apex scripts for the current org/alias. Call this tool when you need to fetch saved Apex scripts.',
    savedScriptsAlias: 'Optional org alias to fetch saved Apex scripts for',
    saveScript:
        'Save an Apex script as a reusable asset, either globally or for a specific org.',
    getCurrentTab:
        'Get the content of the current Apex tab in the Apex Editor (body, id, etc.).',
} as const;

export const API_TOOL_DESCRIPTIONS = {
    getTabs:
        'Get all API tabs currently open in the API editor.\n        Returns an array of tab objects representing the current open API tabs.\n        Use this to list or inspect all open tabs.',
    selectTab:
        'Select a tab by its ID in the API editor.\n        The tabId must correspond to an existing tab.\n        If the tabId does not exist, the selection will fail.',
    upsertTab:
        'Add or update a tab in the API editor.\n        If the tab.id matches an existing tab, that tab will be updated.\n        If the tab.id is new, a new tab will be created.\n        When creating a new tab, ensure the id is unique and not reused from an existing tab.\n        Reusing an existing tab id for a new tab is not allowed and will result in updating the existing tab instead.',
    recentCalls:
        'Get the list of recent API calls.\n        Returns an array of recent API call objects, ordered from most recent to least recent.',
    savedScripts:
        'Get the list of saved API scripts.\n        Only scripts that are global or associated with an alias are returned.\n        Use this to retrieve reusable API scripts.',
    openApiSavedScripts:
        'Get the list of saved OpenAPI schema files.\n        Returns all OpenAPI schema files currently available in the editor.',
    openApiMethodForScript:
        'Get the OpenAPI method definition for a specific script and HTTP method.\n        Provide a valid scriptId and HTTP method (GET, POST, etc.).\n        Returns the path, method, and operation details if found, otherwise returns null.',
    updateBody:
        'Update the body for a specific tab.\n        The tabId must correspond to an existing tab.\n        The body should be a string representing the request payload.',
    updateHeader:
        'Update the header for a specific tab.\n        The tabId must correspond to an existing tab.\n        The header should be a string representing the request headers.',
    updateVariable:
        'Update the global variables for the API editor.\n        Variables should be provided as a JSON string.\n        This will overwrite all existing variables.',
    updateEndpoint:
        'Update the endpoint for a specific tab.\n        The tabId must correspond to an existing tab.\n        The endpoint should be a valid API endpoint string.',
    updateMethod:
        'Update the HTTP method for a specific tab.\n        The tabId must correspond to an existing tab.\n        The method should be a valid HTTP method string (e.g., GET, POST, PUT, DELETE).',
    navigateToEditor:
        'Navigate the user interface to the API editor.\n        Use this to programmatically switch the application view to the API editor.\n        No parameters are required. Returns { success: true } if navigation is triggered.',
    applicationContext:
        'Get the current application context for the API editor.\n        Returns information about the current editor state.\n        No parameters are required.',
} as const;

export const CHROME_SCREENSHOT_FORMATS = ['png', 'jpeg'] as const;

export const CHROME_TOOL_DESCRIPTIONS = {
    screenshot: '[Chrome] Take a screenshot of the current tab/window.',
    openTab: '[Chrome] Open a new browser tab with the specified URL.',
    navigateTab: '[Chrome] Navigate to a specific browser tab by tabId.',
    listTabs: '[Chrome] Get a list of all open browser tabs.',
    listTabGroups: '[Chrome] Get a list of all browser tab groups.',
    groupTabs: '[Chrome] Group tabs together and optionally move them to another window.',
    getWindows: '[Chrome] Get a list of all open browser windows.',
    ungroupTabs: '[Chrome] Remove tabs from their group (ungroup).',
    closeTabs: '[Chrome] Close one or more tabs by ID.',
    updateTab:
        '[Chrome] Update tab properties (navigate to a new URL, pin, mute, activate, etc). Use this to change the URL of a specific tab (navigate), or update other properties.',
    createWindow: '[Chrome] Create a new window, optionally with specific tab IDs.',
    getTab: '[Chrome] Get info for a specific tab by ID.',
    getTabGroup: '[Chrome] Get info for a tab group by ID.',
    updateTabGroup: '[Chrome] Update tab group properties (title, color).',
    moveTab: '[Chrome] Move a tab to a specific index in a window.',
    highlightTabs: '[Chrome] Highlight (select) one or more tabs in a window.',
    focusWindow: '[Chrome] Focus a specific window by ID.',
    removeTabGroup: '[Chrome] Remove a tab group (ungroup and delete the group).',
    duplicateTab: '[Chrome] Duplicate a tab by ID.',
    reloadTabs: '[Chrome] Reload one or more tabs.',
} as const;

export const CONNECTION_REDIRECT_APPLICATIONS = [
    'api',
    'soql',
    'anonymousApex',
    'agent',
    'connections',
    'settings',
    'accessAnalyzer',
    'org',
    'code',
    'metadata',
    'object',
    'doc',
    'recordViewer',
    'platformevent',
    'package',
    'assistant',
    'settings',
    'release',
] as const;

export const CONNECTION_TOOL_DESCRIPTIONS = {
    listConnections:
        'List all Salesforce org connections (aliases, usernames, etc.) available in the toolkit.',
    connectOrg: `Connect to a Salesforce org. 

    ## Instructions:
    - Set Redirect to a specific application (applicationName=api) to open a specific application but by default you can keep it null

    ## Applications available:
        - api: Open the API Explorer
        - soql: Open the SOQL Editor
        - anonymousApex: Open the Anonymous Apex Editor
        - agent: Open the Agent
        - connections: Open the Connections
        - settings: Open the Settings
        - accessAnalyzer: Open the Access Analyzer
        - org: Open the Org. Overview
        - code: Open the Code Toolkit
        - metadata: Open the Metadata Explorer
        - object: Open the SObject Explorer
        - doc: Open the Documentation
        - recordViewer: Open the Record Viewer
        - platformevent: Open the Event Explorer
        - package: Open the Deploy/Retrieve
        - assistant: Open the AI Assistant
        - settings: Open the Settings
        - release: Open the Release Notes
    `,
    connectRedirect: 'The redirect url to open (applicationName=api)',
    disconnectOrg: 'Disconnect from the current Salesforce org (removes session).',
    navigateToOrg:
        'Navigate to a Salesforce org. Redirect is optional and can be used to open a specific page/application specific to salesforce.',
} as const;

export const GENERAL_TOOL_DESCRIPTIONS = {
    currentApplication: 'Get the current application name in the toolkit.',
    currentConnection: 'Get the current user/connection information.',
    checkLoggedIn: 'Check if the user is logged in.',
} as const;

export const METADATA_TOOL_DESCRIPTIONS = {
    navigate: 'Navigate to the Metadata Explorer application.',
    openTab: 'Open a specific metadata tab in the Metadata Explorer.',
    listTypes: '[Incognito] List all available metadata types in the org.',
    listRecords: '[Incognito] List all records for a given metadata type.',
    getRecord: '[Incognito] Get details and files for a specific metadata record.',
    describeObject:
        'Fetch describe/objectInfo (fields, types, etc.) for a given SObject name.',
} as const;

export const SOQL_TOOL_DESCRIPTIONS = {
    query:
        'Display and execute an SOQL query in the Workbench Query Editor. Only suitable when the user want to see the query/result in the Workbench Query Editor.',
    queryTabId:
        'Optional tab ID to reuse when the tool is called again with the same context/request',
    queryIncognito:
        'Execute a SOQL query (Incognito mode) without displaying it in the UI. Recommended if you want to execute a query without displaying it in the UI.',
    savedQueries: 'Fetch saved SOQL queries for the current org/alias.',
    displayTab: 'Display a SOQL tab in the Workbench.',
} as const;

export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-_]*$/i;

export const SKILL_ROOT_DIR_BY_SCOPE = {
    project: '/workspace/skills/custom-skills',
    user: '/workspace/.cursor/skills',
} as const;

export const EMPTY_AGENT_TOOL_GROUPS = {
    soql: [],
    apex: [],
    api: [],
    connections: [],
    general: [],
    chrome: [],
    metadata: [],
    agent: [],
} as const;
