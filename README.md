# Qivlink

Fast, privacy-focused URL shortening and content sharing service with zero-tracking redirects, offline vector QR code exports, and an automated 7-day rolling data lifecycle.

## Features

- **Zero-Tracking Shortener**: Instant link generation with automatic sanitization of UTM parameters, click IDs (`fbclid`, `gclid`), and tracking tags.
- **Offline Vector QR Studio**: 100% in-browser generation with lossless SVG and 1024px PNG exports, transparent backgrounds, and direct clipboard copying.
- **Device Beam**: Cross-device link and content transfer using unique device identity tokens and quick drop codes.
- **End-to-End Encryption**: Optional AES-256-GCM encryption with PBKDF2 key derivation for shared notes and credentials.
- **7-Day Rolling Retention**: Strict 168-hour lifecycle automatically purges expired links and transfers.
- **Security Whitelist**: Strict protocol whitelisting (`http:` and `https:`) and loopback/SSRF blocking.

## Quick Start

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build for production
npm run build
```
