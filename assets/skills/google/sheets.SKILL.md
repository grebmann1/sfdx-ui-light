---
name: google-sheets
description: Work with Google Sheets through Do Browser workspace APIs. Use when the user asks to create spreadsheets, inspect sheet metadata, read or write ranges, clear or delete data, append rows, apply formatting, or run batch operations in Google Sheets. This skill covers workspace.status(), workspace.current(), workspace.sheets.requestAccess(), workspace.sheets.createSpreadsheet(), workspace.sheets.getSpreadsheet(), workspace.sheets.listSheets(), workspace.sheets.readRange(), workspace.sheets.batchRead(), workspace.sheets.writeRange(), workspace.sheets.batchWrite(), workspace.sheets.appendRows(), workspace.sheets.clearRange(), workspace.sheets.batchClear(), workspace.sheets.setFormat(), and workspace.sheets.batchUpdate().
---
# Google Sheets

Use this skill to operate on Google Sheets from JS eval in Do Browser.

## Scope

- Handle Google Sheets only.
- Do not use this skill for Docs or Slides tasks.

## Method Reference

### \`workspace.status()\`

Returns connection state:

\`\`\`ts
{
  sheetsConnected: boolean;
  scopes: string[];
  accountEmail: string | null;
}
\`\`\`
\`drive.file\` is file-scoped. Existing spreadsheets must be explicitly authorized via Picker before read/write calls succeed.

### \`workspace.current()\`

Returns the current Sheet context, inferred from the active tab (or currently attached tab):

\`\`\`ts
{
  kind: "sheet";
  spreadsheetId: string;
  tabId: number;
  url: string;
  title: string;
}
\`\`\`

Throws if the current tab is not a Google Sheet.

### \`workspace.sheets.requestAccess(input?)\`

Open the Google Picker flow in a new tab to authorize one or more spreadsheets:

\`\`\`ts
await workspace.sheets.requestAccess({
  spreadsheetId?: string; // optional preselection target
  source?: "agent" | "settings";
});
\`\`\`

### \`workspace.sheets.createSpreadsheet(input)\`

Create a new spreadsheet:

\`\`\`ts
await workspace.sheets.createSpreadsheet({
  title: "Q1 Planning",
  locale?: "en_US",
  timeZone?: "America/Los_Angeles",
  sheetTitle?: "Backlog",
  rowCount?: 2000,
  columnCount?: 26,
});
\`\`\`

Returns:

\`\`\`ts
{
  spreadsheetId: string;
  title: string;
  url: string | null;
  sheets: Array<{
    sheetId: number;
    title: string;
    index: number;
    hidden: boolean;
    rowCount: number | null;
    columnCount: number | null;
  }>;
}
\`\`\`

### \`workspace.sheets.getSpreadsheet(input)\`

Fetch spreadsheet metadata:

\`\`\`ts
await workspace.sheets.getSpreadsheet({
  spreadsheetId?: string; // optional, resolves from active sheet tab when omitted
});
\`\`\`

Returns:

\`\`\`ts
{
  spreadsheetId: string;
  title: string;
  url: string | null;
  sheets: Array<{
    sheetId: number; // numeric sheetId for structural batchUpdate operations
    title: string;
    index: number;
    hidden: boolean;
    rowCount: number | null;
    columnCount: number | null;
  }>;
  namedRanges: Array<{
    name: string;
    sheetId: number | null;
    startRowIndex: number | null;
    endRowIndex: number | null;
    startColumnIndex: number | null;
    endColumnIndex: number | null;
  }>;
}
\`\`\`

### \`workspace.sheets.listSheets(input)\`

Fetch tab metadata only (lighter than \`getSpreadsheet\`):

\`\`\`ts
await workspace.sheets.listSheets({
  spreadsheetId?: string;
});
\`\`\`

### \`workspace.sheets.readRange(input)\`

\`\`\`ts
await workspace.sheets.readRange({
  spreadsheetId?: string; // optional; auto-resolved from workspace.current() when omitted
  range: "Sheet1!A1:C20",
  majorDimension?: "ROWS" | "COLUMNS",
  valueRenderOption?: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA",
  dateTimeRenderOption?: "SERIAL_NUMBER" | "FORMATTED_STRING",
});
\`\`\`

Returns:

\`\`\`ts
{
  spreadsheetId: string;
  range: string;
  majorDimension?: "ROWS" | "COLUMNS";
  values: Array<Array<string | number | boolean | null>>;
}
\`\`\`

### \`workspace.sheets.batchRead(input)\`

Read multiple ranges in one call:

\`\`\`ts
await workspace.sheets.batchRead({
  spreadsheetId?: string;
  ranges: ["Sheet1!A1:B10", "Sheet1!D1:E10"],
  valueRenderOption: "UNFORMATTED_VALUE",
});
\`\`\`

### \`workspace.sheets.writeRange(input)\`

\`\`\`ts
await workspace.sheets.writeRange({
  spreadsheetId?: string;
  range: "Sheet1!A1:C3",
  values: [
    ["Name", "Score", "Passed"],
    ["Ava", 95, true],
  ],
  valueInputOption: "RAW" // or "USER_ENTERED"
});
\`\`\`

Returns update counts and updated range.

### \`workspace.sheets.batchWrite(input)\`

Write multiple ranges in one call:

\`\`\`ts
await workspace.sheets.batchWrite({
  spreadsheetId?: string,
  valueInputOption: "RAW",
  data: [
    { range: "Sheet1!A1:B2", values: [["a", "b"], [1, 2]] },
    { range: "Sheet1!D1:D2", values: [[true], [false]] },
  ],
});
\`\`\`

### \`workspace.sheets.appendRows(input)\`

\`\`\`ts
await workspace.sheets.appendRows({
  spreadsheetId?: string;
  range: "Sheet1!A:C",
  values: [
    ["2026-02-17", "north", 1200],
  ],
  valueInputOption: "RAW" // or "USER_ENTERED"
});
\`\`\`

Returns append metadata (\`tableRange\`, \`updatedRange\`, \`updatedRows\`, \`updatedCells\`).

### \`workspace.sheets.clearRange(input)\`

Clear values in a single range while keeping structure:

\`\`\`ts
await workspace.sheets.clearRange({
  spreadsheetId?: string;
  range: "Sheet1!B2:D6";
});
\`\`\`

### \`workspace.sheets.batchClear(input)\`

Clear values in multiple ranges:

\`\`\`ts
await workspace.sheets.batchClear({
  spreadsheetId?: string;
  ranges: ["Sheet1!B2:D6", "Sheet1!G2:G100"];
});
\`\`\`

### \`workspace.sheets.setFormat(input)\` (client-side helper)

High-level A1-first formatting helper. Internally this is converted to a \`batchUpdate\` call in the client.

\`\`\`ts
await workspace.sheets.setFormat({
  spreadsheetId?: string;
  range: "A1:G1"; // bounded A1 only
  sheet?: { sheetTitle: "Sheet1" } | { sheetId: 0 }; // optional if range already includes sheet
  format: {
    text?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      fontSize?: number;
      fontFamily?: string;
      color?: "#RRGGBB";
    };
    fillColor?: "#RRGGBB";
    horizontalAlign?: "LEFT" | "CENTER" | "RIGHT";
    verticalAlign?: "TOP" | "MIDDLE" | "BOTTOM";
    wrapStrategy?: "OVERFLOW_CELL" | "CLIP" | "WRAP";
    numberFormat?: {
      type:
        | "TEXT"
        | "NUMBER"
        | "PERCENT"
        | "CURRENCY"
        | "DATE"
        | "TIME"
        | "DATE_TIME"
        | "SCIENTIFIC";
      pattern?: string;
    };
    borders?: {
      top?: { style: "NONE" | "SOLID" | "SOLID_MEDIUM" | "SOLID_THICK" | "DOTTED" | "DASHED" | "DOUBLE"; color?: "#RRGGBB" };
      right?: { style: "NONE" | "SOLID" | "SOLID_MEDIUM" | "SOLID_THICK" | "DOTTED" | "DASHED" | "DOUBLE"; color?: "#RRGGBB" };
      bottom?: { style: "NONE" | "SOLID" | "SOLID_MEDIUM" | "SOLID_THICK" | "DOTTED" | "DASHED" | "DOUBLE"; color?: "#RRGGBB" };
      left?: { style: "NONE" | "SOLID" | "SOLID_MEDIUM" | "SOLID_THICK" | "DOTTED" | "DASHED" | "DOUBLE"; color?: "#RRGGBB" };
    };
  };
});
\`\`\`

Example:

\`\`\`ts
await workspace.sheets.setFormat({
  spreadsheetId,
  sheet: { sheetTitle: "Top Albums" },
  range: "A1:G1",
  format: {
    text: { bold: true, color: "#FFFFFF" },
    fillColor: "#1E40AF",
    horizontalAlign: "CENTER",
  },
});
\`\`\`

### \`workspace.sheets.batchUpdate(input)\`

Passes raw Google Sheets \`batchUpdate\` requests:

\`\`\`ts
await workspace.sheets.batchUpdate({
  spreadsheetId?: string;
  requests: [
    { addSheet: { properties: { title: "Backup" } } }
  ]
});
\`\`\`

Use this for structural or advanced operations that are not covered by \`setFormat\`, \`readRange\`, \`writeRange\`, or \`appendRows\`.

### Deleting / clearing ranges

Interpret "delete range" first:

- Clear values only (keep sheet structure): use \`clearRange\` (or \`batchClear\`).
- Delete cells/rows/columns structurally: use \`batchUpdate\` (\`deleteRange\` / \`deleteDimension\`).

Clear values example:

\`\`\`ts
await workspace.sheets.clearRange({
  spreadsheetId,
  range: "Sheet1!B2:D6",
});
\`\`\`

Structural delete example (shift rows up):

\`\`\`ts
const meta = await workspace.sheets.listSheets({ spreadsheetId });
const sheetId = meta.sheets.find((s) => s.title === "Sheet1")?.sheetId;
if (sheetId == null) throw new Error("Sheet1 not found");

await workspace.sheets.batchUpdate({
  spreadsheetId,
  requests: [
    {
      deleteRange: {
        range: {
          sheetId, // numeric Google sheetId
          startRowIndex: 1,
          endRowIndex: 6,
          startColumnIndex: 1,
          endColumnIndex: 4,
        },
        shiftDimension: "ROWS",
      },
    },
  ],
});
\`\`\`

Important: structural delete requests need numeric \`sheetId\` (from \`listSheets\` / \`getSpreadsheet\`).

## Standard Workflow

1. Check access with \`workspace.status()\`.
2. If disconnected, ask the user to connect Sheets.
3. For existing spreadsheets under \`drive.file\`, run \`workspace.sheets.requestAccess({ spreadsheetId? })\` before read/write if access is missing.
4. If needed, create a new file with \`createSpreadsheet\`.
5. Resolve context with \`workspace.current()\` unless \`spreadsheetId\` is explicitly provided.
6. For common styling, prefer \`setFormat\` (A1-first).
7. If structural operations are needed, call \`listSheets\` first to get numeric \`sheetId\`.
8. Read data with \`readRange\` or \`batchRead\`.
9. Transform data in JS.
10. Write with \`writeRange\`, \`batchWrite\`, \`appendRows\`, \`clearRange\`, \`batchClear\`, \`setFormat\`, or \`batchUpdate\`.
11. Verify by reading back affected ranges.

## Rules for Reliable Execution

- Prefer explicit ranges with sheet names, like \`Sales!A1:F200\`.
- Keep writes narrow; avoid full-sheet writes unless requested.
- Use \`valueInputOption: "USER_ENTERED"\` for formulas/date parsing; otherwise default to \`"RAW"\`.
- For typed reads, set \`valueRenderOption: "UNFORMATTED_VALUE"\` to preserve numbers/booleans.
- Confirm whether "delete" means clear values or remove cells/rows/columns.
- Use \`batchRead\` / \`batchWrite\` for fewer network round trips.
- Use \`setFormat\` for common formatting (headers, colors, alignment, borders).
- Use \`batchUpdate\` for structural or advanced operations (dimensions, delete/insert/move/protect, unsupported formatting patterns).

## Common Error Meanings

- \`Google Sheets access is not connected. Connect Sheets in Settings.\`  
  The user has not granted Sheets scope yet.
- \`Active tab is not a Google Sheet. Open a Sheet tab or pass spreadsheetId.\`  
  Open the target spreadsheet tab or pass a valid \`spreadsheetId\`.
- \`spreadsheetId is required. Use workspace.current() to resolve the active sheet.\`  
  Supply \`spreadsheetId\` when no Sheet tab is active.
- \`Google Sheets API error (4xx/5xx): ...\`  
  The request shape, range, permissions, or API state is invalid. Surface the message and adjust input.
- \`SHEETS_FILE_NOT_AUTHORIZED: ...\`  
  The target file has not been authorized under \`drive.file\`. Call \`workspace.sheets.requestAccess({ spreadsheetId })\`, then retry.

## Minimal Starter Snippet

\`\`\`ts
const status = await workspace.status();
if (!status.sheetsConnected) {
  throw new Error("Sheets is not connected. Ask the user to connect it in Settings.");
}

const current = await workspace.current();
const meta = await workspace.sheets.listSheets({ spreadsheetId: current.spreadsheetId });
const read = await workspace.sheets.batchRead({
  spreadsheetId: current.spreadsheetId,
  ranges: ["Sheet1!A1:C20"],
  valueRenderOption: "UNFORMATTED_VALUE",
});

const values = read.valueRanges[0]?.values ?? [];
// ...transform values...

await workspace.sheets.writeRange({
  spreadsheetId: current.spreadsheetId,
  range: "Sheet1!E1:G20",
  values,
  valueInputOption: "RAW",
});
\`\`\`