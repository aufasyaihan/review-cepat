<!--
Sync Impact Report — temporary scratch material, remove before committing.
  Version change: none (initial write) → 1.0.0
  Modified principles: none (initial adoption)
  Added sections: Core Principles (I–IX), Governance
  Removed sections: none
  Deferred TODOs: none
-->

# NFC Platform Constitution

This constitution defines the permanent engineering principles for the NFC Platform
project. All specifications, plans, tasks, and implementations must comply with these
principles.

## Core Principles

### I. Architecture First

The project follows a **Domain-Based Modular Monolith** architecture.

- Every business capability belongs to a single domain.
- The `app/` directory is responsible only for routing and page composition.
- Business logic never lives inside `page.tsx` or `layout.tsx`.

Rationale: capability-per-domain keeps each domain independently extractable into a
backend service (see IX. Scalability) with routing kept as a thin composition layer.

### II. Frontend Principles

- Every `page.tsx` is a Server Component.
- Every `layout.tsx` is synchronous and contains no data fetching.
- Every page must stream data using TanStack Query prefetching and hydration.
- Client components consume data only through TanStack Query.

### III. API Principles

- All networking goes through the domain API layer.
- No component or hook may call `fetch()` directly.
- Route Handlers only translate HTTP requests into domain services.

### IV. Quality Standards

Every feature is incomplete unless it includes:

- Unit tests.
- Coverage above project threshold.
- End-to-end tests for critical user flows.
- Error handling.
- Loading states.
- Empty states.

### V. Testing Requirements

- Node.js Test Runner for unit tests.
- React Testing Library for component tests.
- Playwright for end-to-end tests.
- MSW for API mocking.
- Minimum overall coverage is **90%**.

### VI. Observability

- Pino is the only logging library.
- Every request must include structured logs.
- Errors must be logged with context.

### VII. Security

- Authentication uses Better Auth.
- Authorization uses RBAC.
- Secrets are never committed.
- Validation uses Zod at every input boundary.

### VIII. Code Quality

- TypeScript strict mode.
- Biome handles formatting and linting.
- Pull requests must pass CI before merging.

### IX. Scalability

The project must remain easy to separate into independent backend services in the
future without rewriting the frontend.

## Governance

- This constitution supersedes all other practices; conflicts resolve in favor of the
  constitution.
- All specifications, plans, tasks, and implementations MUST comply with its
  principles; PRs and reviews MUST verify compliance before merge.
- Amendments MUST be documented, versioned, and approved before taking effect.
- Versioning follows semantic versioning:
  - MAJOR for backward-incompatible principle removals or redefinitions.
  - MINOR for new or materially expanded principles.
  - PATCH for clarifications, wording, and non-semantic refinements.
- Compliance review is part of the standard review process and may be raised on any
  spec, plan, task set, or implementation.

**Version**: 1.0.0 | **Ratified**: 2026-09-13 | **Last Amended**: 2026-09-13