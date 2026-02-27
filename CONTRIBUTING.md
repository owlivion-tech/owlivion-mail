# Contributing to Owlivion Mail

Thank you for your interest in contributing to Owlivion Mail! This guide will help you get started.

## Code of Conduct

Be respectful, constructive, and inclusive. We're building privacy-focused software together.

## Getting Started

### Prerequisites

- **Rust** (stable, latest)
- **Node.js** 20+
- **pnpm** 8+
- **System dependencies** (Linux):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```

### Development Setup

```bash
git clone https://github.com/babafpv/owlivion-mail.git
cd owlivion-mail
pnpm install
pnpm tauri:dev
```

### Project Structure

```
src/            # React frontend (TypeScript)
src-tauri/      # Rust backend (Tauri v2)
public/         # Static assets
docs/           # Documentation
```

## Development Guidelines

### Code Standards

- **TypeScript**: Strict mode, no `any` types
- **Rust**: No `unwrap()` in production code — use `thiserror`/`anyhow`
- **Variables & comments**: English
- **Styling**: Tailwind CSS utility classes

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add email snooze functionality
fix: resolve IMAP connection timeout on slow networks
docs: update PGP setup guide
chore: bump tauri to v2.9
refactor: extract email parser into separate module
```

### Testing

Before submitting a PR, run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
pnpm build        # TypeScript compilation check
cargo audit       # Security audit (Rust)
npm audit         # Security audit (JS)
```

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`
2. **Make your changes** with clear, focused commits
3. **Test** your changes locally on your platform
4. **Submit a PR** with:
   - Clear title following conventional commits format
   - Description of what changed and why
   - Screenshots for UI changes
   - Test steps for reviewers

### PR Review Criteria

- [ ] No `any` types in TypeScript
- [ ] No `unwrap()` in Rust production code
- [ ] No hardcoded secrets or credentials
- [ ] No external CDN calls (all assets must be bundled)
- [ ] Tests pass (`cargo test` + `pnpm build`)
- [ ] No telemetry, analytics, or tracking code

## Security

**This is non-negotiable.** Owlivion Mail's core promise is privacy:

- Zero telemetry, zero analytics, zero tracking
- All credentials via OS keychain
- PGP keys managed locally, never transmitted
- No external network calls except user-initiated email operations
- CSP headers enforced

If you find a security vulnerability, **do not open a public issue**. See [SECURITY.md](SECURITY.md) for responsible disclosure.

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/babafpv/owlivion-mail/labels/good%20first%20issue) — these are great starting points for new contributors.

## Questions?

Open a [Discussion](https://github.com/babafpv/owlivion-mail/discussions) or reach out at hello@owlivion.com.

---

Thank you for helping make email private again!
