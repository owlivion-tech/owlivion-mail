
## Gelecek Özellikler

# CLAUDE.md - Owlivion Mail Context

## Project Identity
- **Name:** Owlivion Mail
- **Type:** Secure Desktop Email Client (Tauri v2).
- **Core:** Privacy-focused, AI Phishing Detection (Gemini), Tracking Pixel Blocker.
- **Security:** Local storage (AES-256-GCM), Zeroize memory wiping.

## Tech Stack
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS.
- **Backend:** Rust (Tauri v2), SQLite (rusqlite), async-imap/smtp.
- **Crypto:** Ring library, HKDF key derivation.

## Roadmap: Account Sync (Upcoming)
- **Goal:** Cross-platform sync via Owlivion Account.
- **Server:** Owlivion VPS (31.97.216.36).
- **Data:** Account settings, Contacts, Preferences, Signatures.
- **Security:** Encrypted storage (Server-side).

## File Structure Map
- `/src`: React Frontend (UI, Components, Services).
- `/src-tauri`: Rust Backend.
  - `/db`: SQLite operations.
  - `/mail`: IMAP/SMTP handling.
  - `/crypto.rs`: Encryption logic.
- `/landing`: Website assets.

## Development Commands
- **Run Dev:** `pnpm tauri dev`
- **Build:** `pnpm tauri build`
- **Test:** `cd src-tauri && cargo test`

## Coding Rules
1. **Language:** Answer in **Turkish**. Comments/variables in English.
2. **Security:** Never expose secrets. Use `Zeroize` for sensitive memory.
3. **UI/UX:** Maintain Dark/Light theme compatibility.
4. **Sync Logic:** Future sync implementation must prioritize end-to-end encryption before sending to VPS.
  
  

