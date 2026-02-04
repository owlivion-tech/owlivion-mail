<p align="center">
  <img src="landing/logo.png" alt="Owlivion Mail" width="120" height="120">
</p>

<h1 align="center">Owlivion Mail</h1>

<p align="center">
  <strong>Smart, Secure, Free Email Client</strong>
</p>

<p align="center">
  <a href="https://github.com/babafpv/owlivion-mail/releases"><img src="https://img.shields.io/github/v/release/babafpv/owlivion-mail?style=flat-square" alt="Release"></a>
  <a href="https://github.com/babafpv/owlivion-mail/blob/main/LICENSE"><img src="https://img.shields.io/github/license/babafpv/owlivion-mail?style=flat-square" alt="License"></a>
  <a href="https://github.com/babafpv/owlivion-mail/stargazers"><img src="https://img.shields.io/github/stars/babafpv/owlivion-mail?style=flat-square" alt="Stars"></a>
  <a href="https://owlivion.com/mail"><img src="https://img.shields.io/badge/website-owlivion.com%2Fmail-blue?style=flat-square" alt="Website"></a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#supported-services">Supported Services</a> •
  <a href="#development">Development</a> •
  <a href="#security">Security</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## About

Owlivion Mail is a privacy-respecting, AI-powered open-source desktop email client. It detects phishing attacks, blocks tracking pixels, and securely stores your passwords.

**Free forever. No ads. Open source.**

## Features

### 🤖 AI-Powered Phishing Detection
- Real-time email analysis with Google Gemini AI
- Suspicious link and content detection
- Risk level assessment (Low/Medium/High/Critical)
- Rule-based fallback system (works without API)

### 🛡️ Tracking Pixel Blocking
- Recognizes 60+ marketing services (Mailchimp, SendGrid, HubSpot, etc.)
- Automatic tracking pixel detection
- Blocks read receipt transmission
- Privacy protection

### 🔐 End-to-End Security
- **AES-256-GCM** encryption
- **HKDF** key derivation
- Automatic password wiping from memory (Zeroize)
- Machine-based key generation
- SSL/TLS enforcement (no insecure connections)

### 📧 Email Management
- Multiple account support
- Unified inbox
- Folder management (IMAP)
- Email starring
- Search (FTS5 full-text search)
- HTML and plain text viewing

### 🎨 Modern Interface
- Dark/Light theme
- Turkish and English language support
- Responsive design
- Keyboard shortcuts

### ⚡ Performance
- Rust backend (fast and secure)
- SQLite database
- Asynchronous IMAP/SMTP
- Low memory usage

## Screenshots

<p align="center">
  <img src="docs/screenshots/main.png" alt="Main Screen" width="800">
</p>

## Installation

### Pre-built Downloads

Download the appropriate version for your operating system from the [Releases](https://github.com/babafpv/owlivion-mail/releases) page:

| Platform | Download |
|----------|----------|
| Windows | `owlivion-mail_x.x.x_x64-setup.exe` |
| macOS | `owlivion-mail_x.x.x_x64.dmg` |
| Linux (deb) | `owlivion-mail_x.x.x_amd64.deb` |
| Linux (AppImage) | `owlivion-mail_x.x.x_amd64.AppImage` |

### Building from Source

#### Requirements

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v8+)
- [Rust](https://rustup.rs/) (1.70+)
- Tauri CLI: `cargo install tauri-cli`

#### Steps

```bash
# Clone the repository
git clone https://github.com/babafpv/owlivion-mail.git
cd owlivion-mail

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Supported Services

Owlivion Mail works with all email services that support IMAP/SMTP:

| Service | IMAP | SMTP | Auto-config | OAuth2 |
|---------|------|------|-------------|--------|
| Gmail | ✅ | ✅ | ✅ | ✅ |
| Outlook/Hotmail | ✅ | ✅ | ✅ | ✅ |
| Yahoo Mail | ✅ | ✅ | ✅ | ⏳ |
| iCloud Mail | ✅ | ✅ | ✅ | ❌ |
| Yandex Mail | ✅ | ✅ | ✅ | ❌ |
| GMX | ✅ | ✅ | ✅ | ❌ |
| Zoho Mail | ✅ | ✅ | ✅ | ❌ |
| FastMail | ✅ | ✅ | ✅ | ❌ |
| Mailbox.org | ✅ | ✅ | ✅ | ❌ |
| Tutanota | ❌ | ❌ | - | ❌ |
| ProtonMail | ⚠️ | ⚠️ | Requires Bridge | ❌ |

**+40 other services** are supported with auto-configuration.

> **Note:** Gmail and Outlook support OAuth2 (one-click login). For other services, you can use app passwords or manual configuration.

## Configuration

### AI Phishing Detection (Optional)

For phishing detection with Gemini AI:

1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Go to Settings → AI Settings → Paste into Gemini API Key field

> Rule-based detection works without an API key.

### Language Setting

You can select Turkish or English from Settings → General → Language.

### Theme

You can select Dark or Light theme from Settings → Appearance → Theme.

### OAuth2 Authentication (One-Click Login)

Owlivion Mail supports OAuth2 for Gmail and Microsoft/Outlook accounts, allowing you to add accounts with just one click without needing app passwords.

#### Quick Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Run setup script:**
   ```bash
   ./scripts/setup-oauth.sh
   ```

3. **Or manually configure:**
   - Get Google OAuth2 credentials from [Google Cloud Console](https://console.cloud.google.com/)
   - Get Microsoft OAuth2 credentials from [Azure Portal](https://portal.azure.com/)
   - Add credentials to `.env` file

📖 **For detailed step-by-step instructions, see [OAUTH_SETUP.md](OAUTH_SETUP.md)**

#### Features
- ✅ One-click account addition
- ✅ No app passwords needed
- ✅ Automatic token refresh
- ✅ Secure OAuth2 flow
- ✅ Works with Gmail and Microsoft/Outlook

> **Note:** OAuth2 is optional. You can still use app passwords for manual configuration.

## Security

### Encryption Details

```
Algorithm: AES-256-GCM
Key Derivation: HKDF-SHA256
Nonce: 12 bytes random
Salt: 32 bytes installation-based
Key Source: Machine ID + User + Salt
```

### Security Features

- ✅ Passwords stored encrypted in database
- ✅ Passwords wiped from memory after use (zeroize)
- ✅ SSL/TLS enforced (insecure connections blocked)
- ✅ SSRF protection (localhost/private IP blocked)
- ✅ Rate limiting (brute force protection)
- ✅ SQL injection protection (FTS5 sanitization)
- ✅ Sensitive information not written to logs

### Security Vulnerability Reporting

If you find a security vulnerability, please report it to [security@owlivion.com](mailto:security@owlivion.com).

## Development

### Project Structure

```
owlivion-mail/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── services/           # API services
│   └── App.tsx             # Main application
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── lib.rs          # Tauri commands
│   │   ├── db/             # SQLite database
│   │   ├── mail/           # IMAP/SMTP operations
│   │   └── crypto.rs       # Encryption
│   └── Cargo.toml
├── landing/                # Website
└── package.json
```

### Technologies

**Frontend:**
- React 18
- TypeScript
- Vite
- TailwindCSS

**Backend:**
- Rust
- Tauri v2
- SQLite (rusqlite)
- async-imap / async-smtp
- ring (cryptography)

### Commands

```bash
# Development
pnpm tauri dev

# Lint
pnpm lint

# Format
pnpm format

# Test (Rust)
cd src-tauri && cargo test

# Build
pnpm tauri build
```

## Contributing

We welcome your contributions!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

### Development Guidelines

- Code comments can be in Turkish or English
- Commit messages can be in Turkish or English
- Run `pnpm lint` before opening a PR
- Add detailed descriptions for security changes

## Roadmap

- [ ] Email composing/replying
- [ ] Calendar integration
- [ ] Contacts management
- [ ] PGP encryption
- [ ] Mobile app (iOS/Android)
- [ ] Multi-device sync

## FAQ

<details>
<summary><strong>I can't connect to Gmail</strong></summary>

For Gmail, you need to use an [App Password](https://myaccount.google.com/apppasswords) instead of your regular password. 2FA must be enabled.
</details>

<details>
<summary><strong>Where is my data stored?</strong></summary>

All data is stored locally on your computer:
- Windows: `%APPDATA%\com.owlivion.owlivion-mail`
- macOS: `~/Library/Application Support/com.owlivion.owlivion-mail`
- Linux: `~/.local/share/com.owlivion.owlivion-mail`
</details>

<details>
<summary><strong>Are my passwords secure?</strong></summary>

Yes. Your passwords are encrypted with AES-256-GCM and can only be decrypted on your computer. The encryption key is generated based on your machine.
</details>

<details>
<summary><strong>Does it work offline?</strong></summary>

Previously downloaded emails can be read offline. Internet connection is required to receive/send new emails.
</details>

## License

This project is licensed under the [MIT License](LICENSE).

```
MIT License - Summary:
✅ Commercial use
✅ Modification
✅ Distribution
✅ Private use
❌ Liability
❌ Warranty
```

## Contact

- **Website:** [owlivion.com/mail](https://owlivion.com/mail)
- **GitHub:** [github.com/babafpv/owlivion-mail](https://github.com/babafpv/owlivion-mail)
- **Email:** [contact@owlivion.com](mailto:contact@owlivion.com)
- **Twitter:** [@owlivion](https://twitter.com/owlivion)

---

<p align="center">
  Made with ❤️ by <strong>Owlivion</strong>
</p>

<p align="center">
  <a href="https://owlivion.com">owlivion.com</a>
</p>
