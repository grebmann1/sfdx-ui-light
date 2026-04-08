---
name: gmail-automation
description: Automate Gmail tasks like sending emails, checking the sent folder, and managing drafts using browser automation. Use when the user asks to "send an email to X", "email Y about Z", "check if the email to A was sent", or any task involving interacting with the Gmail web interface.
---

# Gmail Automation

This skill provides a reliable workflow for automating Gmail through the browser. Gmail's interface is highly dynamic; do not rely on hardcoded element references (\`e1\`, \`e2\`, etc.).

## Core Workflow Loop

Gmail frequently re-renders. Always follow this loop for interaction:
1. **Snapshot**: Get a fresh \`getSnapshot(page)\`.
2. **Identify**: Find the element in the YAML by its **Role** and **Accessible Name**.
3. **Reference**: Note the current \`[ref=eN]\` for that specific snapshot.
4. **Interact**: Use \`getElementByRef(page, "eN")\` immediately.

## Common Interaction Points

When looking at the snapshot, look for these specific roles and names:

| Action | Target Role | Target Name |
| :--- | :--- | :--- |
| **Start Email** | \`button\` | "Compose" |
| **Recipient** | \`combobox\` | "To recipients" |
| **Subject** | \`textbox\` | "Subject" |
| **Email Body** | \`textbox\` | "Message Body" |
| **Send** | \`button\` | "Send *(Enter)," |
| **Sent Folder** | \`link\` | "Sent" |
| **Success Check** | \`alert\` | Look for text "Message sent" |

## Robust Handling Tips

- **Dynamic UI**: Gmail's "Compose" window is a dialog. If you can't find the fields, look for a \`dialog\` or \`region\` labeled "New Message" in the snapshot.
- **Recipient Entry**: After using \`type()\` on the "To" field, always send \`page.keyboard.press("Enter")\`. Gmail needs this to convert the text into a recipient "chip."
- **Detached Nodes**: If you get an error that a node is "detached from document," it means Gmail updated the UI. Simply take a new snapshot and find the new \`ref\` for the same element name.
- **Wait for Compose**: After clicking "Compose," use a short timeout or \`page.waitForSelector\` for the compose dialog before taking the next snapshot.
