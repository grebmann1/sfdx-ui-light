---
title: How to Contribute
---

# How to Contribute

Contributions are welcome for bug fixes, documentation improvements, and new tooling capabilities.

## Where to contribute

- Repository: [sf-toolkit-web](https://github.com/grebmann1/sf-toolkit-web)
- Source of truth for changes is GitHub pull requests.

## Typical contribution flow

1. Fork the repository.
2. Create a focused branch for one change set.
3. Implement and test locally.
4. Open a pull request with clear context and screenshots when relevant.

## Local validation checklist

Run these before opening a pull request:

```bash
npm run check
npm run site:build
npm run build:web
```

## Pull request expectations

- Keep scope small and reviewable.
- Explain the motivation and user impact.
- Include testing notes and any known limitations.
- Update docs when behavior changes.

## Good first contributions

- Improve troubleshooting pages.
- Add examples and usage docs.
- Tighten UI copy and onboarding guidance.
- Fix isolated bugs with clear reproduction steps.
