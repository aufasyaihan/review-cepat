# Contracts — Public Scan Resolution

External contract for the single public URL encoded on every physical device
(NFC tag / QR code). Full data rules in [data-model.md](../data-model.md).

## GET /s/[slug]

Resolves a device by its immutable `slug` (see `device.slug` in the data model).

### Resolution logic

1. Look up the device by `slug`.
2. Determine outcome from device state (single source of truth):
   - `PUBLISHED` with exactly one active destination → **single-link**.
   - `PUBLISHED` with multiple active destinations → **multi-link**.
   - `UNPUBLISHED` / `DISABLED` / `UNCLAIMED` / `CLAIMED` (no publish) / no active
     destinations → **inactive**.
3. Record a `scan_event` (outcome, source from UA sniff nfc/qr/link, browser,
   deviceType, referrer, country/city best-effort, `ipHash`, `createdAt`)
   **before** any customer-facing response.
4. Respond per outcome below.

### Responses

| Device state | Outcome | Response |
|--------------|---------|----------|
| PUBLISHED + single active destination | `REDIRECTED` | HTTP 3xx redirect to the destination URL (no intermediate page) |
| PUBLISHED + multiple active destinations | `LANDING_SHOWN` | HTTP 200 server-rendered landing page listing all active destination links in `position` order |
| UNPUBLISHED / DISABLED / UNCLAIMED / CLAIMED / no active destination | `INACTIVE` | HTTP 200 server-rendered inactive message page (never forwards) |
| Unknown or malformed `slug` | `NOT_FOUND` | HTTP 404 |

### Guarantees

- Scan recording happens exactly once per request, server-side (never in a browser
  effect), so a successful redirect always has a corresponding `scan_event`.
- No client-side hop: single-link responses are server-side redirects; customers never
  see an intermediate page.
- Landing page is server-rendered, mobile-first, WCAG AA, and carries per-device SEO
  metadata appropriate to the merchant's branding.
- Locale/count fields are best-effort and may be absent without failing the response.
- Unpublished/disabled devices are never forwarded (spec FR-015, SC-005).

### Theming / execution

- This route is in the `(redirect)` route group: **no next-themes provider** and no
  authenticated layout (FR-034), keeping it a fast, plain, server-rendered surface.

### Error handling for the public device route

- Occupied `slug` is prevented at device creation (unique constraint).
- A device whose single destination was later deactivated renders INACTIVE — it never
  redirects to an empty or null URL.

### Rate / abuse surface

`/s/[slug]` is the only unauthenticated, unrate-limited public route with side effects:

- **Every hit inserts a `scan_event` row before responding** (unknown slugs 404 via
  `notFound()` before recording; only resolved devices record).
- **Better Auth rate limiting does not apply**: `auth.api` rate limits cover auth
  endpoints only. This route has no limiter.
- **Abuse vectors**: (1) analytics inflation — repeated hits on a PUBLISHED single-link
  device; (2) resource exhaustion — many concurrent requests forcing MySQL insert load;
  (3) bulk candidate-slug probing (slow, low value: slugs expose no PII).
- **Current mitigations**: server-side-only IP hashing (`ipHash` SHA-256), single
  serial query/insert per request, `createdAt` index for cheap cleanup, written volume
  bounded by physical device placement in normal operation.
- **Known ceilings / upgrade path** (`ponytail:` note): no application-level rate limit
  on this route. If abuse is observed, add per-IP or per-slug token-bucket limiting in
  the domain service or middleware before the route, and/or cap `scan_event` retention
  via an age-based purge job. Do not add a limiter speculatively before real abuse
  signals.