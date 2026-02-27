# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in Owlivion Mail, **please do not open a public issue**.

### How to Report

1. **Email**: Send details to **security@owlivion.com**
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

| Timeline | Action |
|----------|--------|
| 24 hours | Acknowledgment of your report |
| 72 hours | Initial assessment and severity rating |
| 7 days   | Fix development begins for critical/high issues |
| 30 days  | Public disclosure (coordinated with reporter) |

### Severity Ratings

- **Critical**: Remote code execution, credential theft, data exfiltration
- **High**: Encryption bypass, authentication bypass, XSS with credential access
- **Medium**: Information disclosure, CSP bypass, denial of service
- **Low**: Minor information leaks, UI-based issues

## Security Commitments

Owlivion Mail is built on these non-negotiable security principles:

1. **Zero telemetry** — No analytics, tracking, or data collection
2. **Local-first** — Credentials stored in OS keychain, PGP keys never leave device
3. **No external calls** — All assets bundled, no CDN dependencies
4. **CSP enforced** — Content Security Policy active in Tauri webview
5. **Regular audits** — `cargo audit` + `npm audit` before every release

## Scope

### In Scope

- Owlivion Mail desktop application (all platforms)
- Owlivion Sync Server (sync.owlivion.com)
- Official distribution packages (.deb, .AppImage, .dmg, .msi)

### Out of Scope

- Third-party email providers (Gmail, Outlook, etc.)
- User's local system security
- Self-compiled builds from modified source

## Recognition

We appreciate security researchers who help keep Owlivion Mail safe. With your permission, we'll credit you in our security advisories and CHANGELOG.

## Contact

- **Security reports**: security@owlivion.com
- **General inquiries**: hello@owlivion.com
