# NFC Platform — QR / NFC Redirect SaaS

Redirect SaaS where physical NFC tags and QR codes take customers straight to a
destination (Google Reviews, social links, websites) with scan analytics.

## Architecture & flow

- **Merchants are Better Auth organizations**: the `owner` (reseller) manages devices,
  analytics, and sub-merchants (`member`, who manages only their assigned devices).
- **Accountless device setup** (`/{slug}/setup` → claim code → `/{slug}/setup/redirect`):
  a merchant sets up a device with no account. Later, a claim code registers/logs in the
  account — see `specs/001-nfc-qr-redirect/contracts/setup-claim.md`.
- **Claim flows**: dashboard claim with login-or-register; register-with-code joins the
  device's organization as a member; reseller claim adds it to their org.
- **Resets (FR-028)**: owner reset keeps the organization binding; admin reset clears it;
  both rotate the claim code.
- **Public scan** (`/s/[slug]`): single link → server-side redirect; multi link → landing
  page; every scan recorded before the response.

## Tech stack

Next.js 16 (App Router) · Drizzle ORM + MySQL · Better Auth (+ organization plugin) ·
TanStack Query/Form · shadcn/ui on Base UI (sky theme) · phantom-ui skeletons ·
next-themes · Vitest + Playwright (≥90% coverage) · Biome · Pino · GitHub Actions CI.

## Getting started

```bash
npm ci
npx @better-auth/cli migrate     # org plugin tables
npm run db:generate && npm run db:migrate
npm run db:seed                  # ADMIN + demo reseller org + devices
npm run dev                      # http://localhost:3000
```

Full validation scenarios: `specs/001-nfc-qr-redirect/quickstart.md`.

## Deploy

SSH via `scripts/deploy.sh` (pm2, `nfc-platform`). CI in `.github/workflows/ci.yml`.

## Feature docs

Spec, plan, data model, contracts, and tasks live in `specs/001-nfc-qr-redirect/`.