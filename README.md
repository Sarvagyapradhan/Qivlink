# Qvlink

Privacy-focused URL shortener, offline QR studio, long-form Markdown pastebin, and file sharing suite with developer API access and automated 7-day rolling data lifecycle.

Repository: [https://github.com/Sarvagyapradhan/Qvlink](https://github.com/Sarvagyapradhan/Qvlink)

## Features

- **Link Shortener**: Instant URL shortening with tracking/UTM parameter sanitization.
- **QR Studio**: Instant, clean QR code generation with 1-click PNG download and clipboard copy.
- **Paste & Docs**: Write or paste long notes, documents, and code. Features a mobile-responsive formatting toolbar (Bold, Italic, Headings, Code Blocks, Lists, Quotes), live Markdown preview toggle, word/char counters, styled PDF export, and shareable short links.
- **File Sharing**: Upload files up to 10MB (PDFs, images, documents, audio, zip) with instant download links and QR codes.
- **Cross-Device Sharing**: Peer-to-peer style content transfer using device IDs and 6-digit drop codes.
- **User Authentication**: Flexible login via Google OAuth or direct Email/Password. Automatically unifies accounts if the same email address is used across both methods.
- **Developer API Keys**: Signed-in users can generate personal API keys (`qvl_live_...`) to programmatically integrate Qvlink URL shortening, QR generation, and document sharing into their own apps with cURL, JavaScript Fetch, and Python snippets.
- **Fair-Use Guest Protection**: Unauthenticated guest access allows 1 free use per tool every 24 hours, enforced via multi-signal hardware and canvas fingerprinting. Signed-in accounts have unlimited access.
- **History & Auto-Expiry**: Unified index of active items with automated 7-day rolling expiration.
- **Security**: Strict protocol whitelisting (`http:` and `https:`), SSRF filtering, and client-side sanitization.

## Quick Start

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build for production
npm run build
```

