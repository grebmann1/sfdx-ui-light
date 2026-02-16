# Text Compare

Compare two texts side-by-side and review differences. Paste or type in the left and right panes to see a live diff.

## Where to find
- Utilities → Text Compare
- Home quick launcher (Utilities section)

## Key features
- Side-by-side diff viewer (Monaco diff editor)
- Editable left and right panes; paste or type in either
- Copy Left / Copy Right to clipboard
- Swap to exchange left and right content
- Clear to reset both panes
- Ignore whitespace: trim line ends when computing the diff
- Ignore case: treat differences in letter case as unchanged (when supported)

## Persistence
- Left/right text and options (ignore whitespace, ignore case) are cached per org in localStorage so they survive reloads.

## Tips
- Use Ignore whitespace when comparing code or config that only differs in indentation or trailing spaces.
- Use Swap to quickly flip which side is “original” vs “modified” in the diff view.
