# Good First Issues

Issues to create on GitHub with the `good first issue` label.
These are beginner-friendly tasks for new contributors.

## UI / Frontend

1. **Add keyboard shortcut hints to toolbar buttons**
   - Show shortcut (e.g. `Ctrl+N`) as tooltip on hover
   - Files: `src/components/` toolbar buttons
   - Difficulty: Easy

2. **Add "Mark all as read" button to folder view**
   - Button in folder header, calls existing Tauri command
   - Files: `src/App.tsx`, `src-tauri/src/lib.rs`
   - Difficulty: Easy

3. **Improve empty state for search results**
   - Show a friendly message when search returns no results
   - Files: `src/App.tsx` (search area)
   - Difficulty: Easy

4. **Add email count badge to folder list**
   - Show unread count next to each folder name
   - Files: `src/App.tsx` (sidebar)
   - Difficulty: Easy-Medium

## Internationalization

5. **Add English translations for remaining Turkish-only strings**
   - Some UI strings are hardcoded in Turkish
   - Files: various `src/components/` files
   - Difficulty: Easy

6. **Add date format localization**
   - Use locale-aware date formatting (tr-TR / en-US)
   - Files: `src/App.tsx`, components that display dates
   - Difficulty: Easy

## Documentation

7. **Add provider-specific setup guides**
   - Step-by-step for Yahoo, iCloud, Yandex with screenshots
   - Files: `docs/` new markdown files
   - Difficulty: Easy

8. **Translate README to Turkish**
   - Create README.tr.md
   - Difficulty: Easy

## Backend / Rust

9. **Add IMAP IDLE reconnection logging**
   - Better log messages when IDLE connection drops and reconnects
   - Files: `src-tauri/src/mail/async_imap.rs`
   - Difficulty: Medium

10. **Add unit tests for email date parsing**
    - Test various date formats from different providers
    - Files: `src-tauri/src/mail/` test modules
    - Difficulty: Medium
