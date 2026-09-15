# NFC Platform — Canonical Architecture Specification v3.0

Production-ready architecture for the NFC / QR Redirect SaaS.

## Highlights

- Next.js 16 Fullstack (App Router)
- Node.js 22 LTS
- Drizzle ORM + MySQL
- Better Auth
- TanStack Query (SSR Prefetch + Hydration)
- TanStack Form + Zod
- shadcn/ui + Base UI + Phantom UI
- Domain-Based Modular Monolith
- Pino Logging
- Node Test Runner + Playwright
- GitHub Actions CI/CD
- SSH Deploy Script for Hostinger VPS/SSH

---

## Canonical Directory

```text
nfc-platform/
├── app/
├── domains/
├── components/
├── db/
├── lib/
├── providers/
├── hooks/
├── tests/
├── drizzle/
├── docs/
├── scripts/
├── .github/
├── package.json
├── next.config.ts
├── tsconfig.json
├── drizzle.config.ts
└── biome.json
```

---

## Frontend Rules

1. page.tsx is always a Server Component.
2. layout.tsx is always synchronous.
3. Layout never fetches data.
4. Dynamic layouts are allowed.
5. Every page prefetches TanStack Query.
6. Client consumes data using HydrationBoundary + useSuspenseQuery.
7. Every route has loading.tsx and/or Suspense.
8. Every major layout has loading/error/not-found.
9. API calls only through domains/*/api.
10. Phantom UI = Layout only.
11. shadcn/ui = Design System.
12. Base UI = Advanced primitives.

---

## Domain Template

```text
domains/device/
├── api/
│   ├── client.ts
│   ├── queries.ts
│   └── mutations.ts
├── server/
│   ├── service.ts
│   ├── repository.ts
│   ├── mapper.ts
│   └── permissions.ts
├── components/
├── schemas/
├── types.ts
├── constants.ts
├── utils.ts
├── index.ts
└── __tests__/
```

---

## TanStack Query Pattern

Server:

```tsx
const queryClient = getQueryClient();

await queryClient.prefetchQuery(deviceQueries.list());

return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <DevicesPage />
  </HydrationBoundary>
);
```

Client:

```tsx
const { data } = useSuspenseQuery(deviceQueries.list());
```

---

## Drizzle Structure

```text
db/
├── schema/
├── migrations/
├── relations.ts
├── index.ts
└── seed.ts
```

---

## Testing

Frontend:

- node:test
- React Testing Library
- MSW
- Playwright
- c8 coverage

Coverage target: 90%.

---

## Deploy Script

Create scripts/deploy.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

SERVER="${SERVER:?}"
USER="${USER:?}"
APP_DIR="${APP_DIR:?}"
BRANCH="${BRANCH:-main}"

ssh "$USER@$SERVER" <<EOF
set -e
cd $APP_DIR
git fetch origin
git checkout $BRANCH
git reset --hard origin/$BRANCH
npm install
npm run db:migrate
npm run build
pm2 restart nfc-platform || pm2 start npm --name nfc-platform -- start
pm2 save
EOF
```

---

## GitHub CI

.github/workflows/ci.yml

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run coverage
      - run: npm run build
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

---

## GitHub CD

.github/workflows/cd.yml

```yaml
name: CD

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - run: |
          mkdir -p ~/.ssh
          ssh-keyscan ${{ secrets.SERVER_HOST }} >> ~/.ssh/known_hosts

      - env:
          SERVER: ${{ secrets.SERVER_HOST }}
          USER: ${{ secrets.SERVER_USER }}
          APP_DIR: ${{ secrets.SERVER_APP_DIR }}
        run: bash scripts/deploy.sh
```

Required secrets:

- SERVER_HOST
- SERVER_USER
- SERVER_APP_DIR
- SSH_PRIVATE_KEY

---

## package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "node --test",
    "coverage": "c8 node --test",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx db/seed.ts"
  }
}
```
