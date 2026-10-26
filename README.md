# Qivlink — Privacy Link Shortener & Offline QR Studio

**Qivlink** is a fast, privacy-focused URL shortening service designed for instantaneous link generation, zero-tracking redirects, offline vector QR code exports, cross-device content transfer with unique device pairing tokens, and an automated **7-day rolling data lifecycle**.

---

## Key Features

1. **Instantaneous Privacy Link Generation**:
   - Zero-tracking redirect engine that strips UTM tracking tags, `fbclid`, and `gclid`.
   - Custom alias support or clean 6-character auto-generated hash.
   - Immediate redirect preview and 1-click clipboard actions.

2. **Offline Vector QR Studio**:
   - 100% client-side vector rendering with zero network transmissions.
   - SVG vector download (lossless for design and print).
   - High-resolution 1024px PNG export.
   - Direct image copy to system clipboard.
   - Designer presets (Slate, Midnight, Forest, Plum, Cobalt) and transparent background toggle.

3. **Device Beam & Cross-Device Transfer**:
   - Unique device identity generation (e.g. `QIV-XXXX-XXX`) and 6-digit pair PIN.
   - Targeted transfers to specific devices with direct inbox routing.
   - Quick pickup codes (e.g. `QIV-3415`) for ad-hoc sharing to mobile devices.
   - Optional passcode encryption and "burn after first read".

4. **Automated 7-Day Rolling Retention**:
   - Every shortened link and device transfer has a strict 168-hour (7-day) TTL.
   - Expired records are automatically purged on fetch and interval routines.
   - Visual countdown badges show remaining validity (e.g., `6d 23h left`).

5. **Crafted Designer UI/UX**:
   - Non-AI generated look and feel: human, calm, and professional.
   - Soft, flowing ambient mesh gradients with smooth translucent glass cards (`backdrop-filter: blur(28px)`).
   - Pure Vanilla CSS design system with light and dark mode support.
   - Zero marketing hype copy or redundant buzzwords.

6. **Supabase Cloud Backend**:
   - Synchronized across devices using Supabase storage bucket (`qivlink_store`).
   - Integrated with user-provided Supabase project (`https://wjjvobqwnnlzxsovjovx.supabase.co`).
   - Includes ready-to-run PostgreSQL table schemas and auto-purge functions in the in-app Supabase drawer.

---

## Project Structure

```
qivlink/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── supabase.js
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── ShortenerSection.jsx
│   │   ├── QRStudioSection.jsx
│   │   ├── DeviceBeamSection.jsx
│   │   ├── VaultSection.jsx
│   │   ├── SupabaseModal.jsx
│   │   └── RedirectHandler.jsx
│   └── utils/
│       ├── deviceIdentity.js
│       ├── linkManager.js
│       ├── deviceTransferManager.js
│       └── qrGenerator.js
```

---

## Running Locally

```bash
# In the project directory:
npm run dev
```

The application will be live at `http://localhost:5173/`.
