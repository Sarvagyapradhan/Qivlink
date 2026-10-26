# Qivlink — Privacy Link Shortener & Offline QR Studio

**Qivlink** is a high-speed, privacy-first URL shortening and content sharing system designed for instantaneous link generation, zero-tracking redirects, offline vector QR exports, end-to-end encrypted cross-device transfers with pairing tokens, and an automated **7-day rolling data lifecycle**.

---

## Architecture & Security Model

### 1. Zero-Tracking & Protocol Whitelist
- **Allowed Schemes**: Strictly `http:` and `https:`.
- **Blocked Attacks**: Automatically rejects dangerous URI schemes (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, etc.).
- **SSRF / Loopback Protection**: Blocks loopback and intranet addresses (`localhost`, `127.0.0.1`, `0.0.0.0`, `169.254.169.254`, `[::1]`).
- **Telemetry Cleaner**: Automatically strips tracking query tags (`utm_*`, `fbclid`, `gclid`, `mc_eid`, `twclid`, `igshid`, etc.) before redirect.

### 2. End-to-End Encryption (AES-256-GCM)
- Cross-device beamed notes, links, or snippets with passcodes are encrypted client-side using the **Web Crypto API (AES-256-GCM)** with PBKDF2 key derivation (100,000 iterations of SHA-256).
- Zero cleartext payload is stored in Supabase when passcode protection is active.

### 3. Automated 7-Day Rolling Retention
- Strict 168-hour TTL on all shortened links, device registrations, and transfer queues.
- Real-time client and background purge routines remove expired records automatically.

### 4. HTTP Security Headers & SPA Routing
- Configured in `vercel.json`:
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY` (anti-clickjacking)
  - `X-Content-Type-Options: nosniff` (anti-MIME sniffing)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS)
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## Branches & CI/CD Pipeline

The repository uses a dual-branch trunk model:
- **`dev` branch**: Feature development, staging, and automated CI test checks.
- **`main` branch**: Production release branch deployed directly to Vercel.

### GitHub Actions Workflows

1. **CI Pipeline (`.github/workflows/ci.yml`)**:
   - Triggers on: Push to `dev`, PRs to `main` and `dev`.
   - Runs `npm ci`, security audit (`npm audit --audit-level=high`), and bundle compilation (`npm run build`).

2. **CD Pipeline (`.github/workflows/deploy.yml`)**:
   - Triggers on: Push / merge to `main`.
   - Runs build verification and deploys directly to Vercel production.

### Connecting to Vercel

#### Option A: Zero-Config Vercel Dashboard (Recommended)
1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your repository: **`Sarvagyapradhan/Qivlink`**.
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_SERVICE_KEY`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_SECRET_KEY`
   - `VITE_SUPABASE_BUCKET` = `qivlink_store`
4. Click **Deploy**. Vercel will automatically build and deploy every push to `main`!

#### Option B: Automated GitHub Actions Deployment
Add the following secrets under **Repository Settings -> Secrets and variables -> Actions**:
- `VERCEL_TOKEN`: Your Vercel personal access token.
- `VERCEL_ORG_ID`: Your Vercel organization/account ID.
- `VERCEL_PROJECT_ID`: Your Vercel project ID.

---

## Local Development

```bash
# Clone the repository
git clone https://github.com/Sarvagyapradhan/Qivlink.git
cd Qivlink

# Switch to development branch
git checkout dev

# Install dependencies
npm install

# Start local development server
npm run dev

# Run production build check
npm run build
```
