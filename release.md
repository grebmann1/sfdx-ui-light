# SF Toolkit - Release Notes

## Version 1.3.23 - January 10th, 2024
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

## Version 1.3.22 - January 7th, 2024
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