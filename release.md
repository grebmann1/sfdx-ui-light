# SF Toolkit - Release Notes

## Version 1.3.34 - April 28th, 2025
### Enhancement:
- **General**:
  - Add prettier
  - Add Install page (with quick tips)
  - Add Uninstall page (With Google Form)

## Version 1.3.33 - April 10th, 2025
### Enhancement:
- **Salesforce Engineer**:
  - Add localhost Support for Salesforce Engineers

## Version 1.3.32 - March 27th, 2025
### Bug Fix:
- **Connector initialization**:
  - Fix Alias name not being setup when open the chrome extension in a new org.

## Version 1.3.31 - March 26th, 2025
### Bug Fix:
- **Miscellaneous**:
  - UI wasn't rendering properly
  - Store were broken in few places


## Version 1.3.30 - March 18th, 2025
### Enhancements:
- **Shortcut injection**:
  - Open a few application using shortcuts :
    - SOQL Explorer
    - APEX Explorer
    - Org Overview (Home)
    - Toolkit Panel (right side of chrome)
- **Enhanced Caching System**:
  - Implemented sophisticated caching architecture to optimize data storage and retrieval
  - Improved performance in SOQL, Metadata and SObject explorers through background metadata caching and asynchronous updates

## Version 1.3.29 - March 17th, 2025
### Bug Fixes
- **Overlay**:  
  - Removed unused fields.
### Enhancements:
- **Caching**:
  - Add Caching manager to improve caching mechanism in the long run.
- **Header UI Tab** :
  - Add back the Header UI tab (settings -> Show Header Application Tabs).
- **Settings**:
  - Hide sensitives settings in case user is sharing his screen.

## Version 1.3.28 - February 12th, 2025
### Bug Fixes  
- **Overlay**:  
  - Missing icons in the injected overlay.

## Version 1.3.26 - February 9th, 2025
### Enhancements  
- **Copilot**:  
  - All editors now have a copilot button to help you write your queries, code, etc. To activate it, you need to have an OpenAI key configured in the settings.
  - The shortcut to activate the copilot is `CTRL/CMD + K` while the editor is focused.
  - This feature is available in all editors in Beta phase
### Bug Fixes  
- **Shortcut Setting**:  
  - Resolved an issue preventing user from using Shortcuts and configuring them in the settings. (Another issue) 
  - Fixed an issue where the shortcut was not being saved in the settings and preventing the extension from injecting the shortcuts in the Salesforce Page.
- **Picklist suggestion in SOQL Editor**:  
  - It's now possible to use the picklist suggestion in the SOQL Editor.
- **Metadata Explorer**:  
  - Fixed an issue where the Metadata Explorer was not displaying the correct data.
  - Fixed an issue that prevented to display Metadata originated from the Metadata API (Such as CanvasMetadata, etc...)
- **Package Manager**:  
  - Fixed an issue where the Package Manager was not displaying the metadata selector.

### Known Issues
- **Package Manager**:  
  - Selecting a metadata type in the menu shares the view with the Metadata Explorer, resulting in the last selection being reflected in both the Metadata Explorer and the Package Manager due to their shared Redux state.


## Version 1.3.25 - January 20th, 2025
### Bug Fixes  
- **Shortcut Setting**:  
  - Resolved an issue preventing user from using Shortcuts and configuring them in the settings.  
- **Instance Url**:  
  - Instance Url was missing from the Org -> Company information component.

## Version 1.3.24 - January 15th, 2025
### Enhancements  
- **SOQL (Data Explorer)**:  
  - Introduced the ability to open the Data Explorer directly from the Record Viewer (right panel) with a prepopulated query. This streamlines the workflow and saves time.

### Bug Fixes  
- **Data Explorer**:  
  - Resolved an issue where the UI would break if the `Id` field was not selected.  
- **Redirection issue**:  
  - Fixed an issue where certain redirection links were not functioning as expected.


## Version 1.3.23 - January 10th, 2025
### New Features  
- **Record Viewer**:  
  - Introduced a user-friendly interface for visualizing records, akin to the "Chrome Panel" experience.  
  - Enabled direct editing of records within the Record Viewer app, streamlining workflows.  

### Enhancements  
- **SOQL (Data Explorer)**:  
  - Added support for record deletion directly from the SOQL interface.  
  - Implemented query formatting to enhance readability and usability.  

### Bug Fixes  
- **OAuth Error**:  
  - Improved error handling for OAuth session management. If the registered org is not found or the session has expired, a popup message will now notify the user.  
- **Metadata Issues**:  
  - Resolved various metadata-related issues to improve reliability and performance.  

### Other Changes  
- **Removal of Application Tab**:  
  - The Application Tab has been removed to simplify navigation and improve user experience.  

## Version 1.3.22 - January 7th, 2025
### Enhancements
- **Metadata Explorer**:
  - Improved performance for faster data retrieval and processing.
  - Added multi-tab support to enhance user experience and facilitate simultaneous metadata exploration.

## Version 1.3.21 - December 24th, 2024
### New Features
- **All Editors**:
  - Enabled shortcuts for Save & Run operations:
    - `CTRL/CMD + S` to Save
    - `CTRL/CMD + Enter` to Run
- **Data Explorer**:
  - Introduced commenting functionality using `//` to exclude parts of a query for better query management.

## Version 1.3.20 - November 20th, 2024
### Bug Fixes
- **Connection Module**:
  - Fixed the issue with the loading spinner during authorization and redirection to an organization.
- **User Explorer**:
  - Adjusted font size for improved readability.
- **API Explorer**:
  - Enhanced UI for handling large files by integrating Monaco and Workbench visualizers.

## Version 1.3.19 - November 11th, 2024
### New Features
- **UI Overhaul**:
  - Completely redesigned user interface for a modern look and improved usability.
  - Introduced a "Multi-Tab" feature for streamlined navigation across applications.
- **Deploy/Retrieve Module**:
  - Added functionality to deploy packages to Salesforce or retrieve them from Salesforce efficiently.
- **Injected Overlay Module**:
  - Integrated an overlay into Salesforce pages to enable quick search and navigation.
  - Laid the groundwork for a future "bridge" between the app and the Chrome extension.

### Enhancements
- **Localhost Extension**:
  - Transformed the cloud-based application into a fully functional browser-based app, eliminating the need for a proxy server.
- **Performance Improvements**:
  - Optimized load times and overall application responsiveness for a smoother user experience.
- **Extended Salesforce API Support**:
  - Expanded support for additional Salesforce APIs, enhancing the toolkit’s capabilities.
- **Access Analyzer with Web Worker**:
  - Improved performance by executing Access Analyzer computations using web workers.

### Bug Fixes
- **Login Issue**:
  - Fixed an intermittent bug preventing some users from logging in to their Salesforce accounts.
- **Data Sync Error**:
  - Resolved occasional data synchronization failures between the toolkit and Salesforce.