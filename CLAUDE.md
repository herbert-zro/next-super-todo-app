# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `packageManager` in package.json). Use it, not npm/yarn.

- `pnpm dev` — start Next.js dev server (Turbopack-less, plain `next dev`)
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm lint` — ESLint (uses `eslint-config-next` core-web-vitals + typescript presets)

### Prisma

`prisma.config.ts` (not `package.json`) is the Prisma config — it loads `DATABASE_URL` from `.env` via `dotenv/config`. There is no `prisma` npm script; invoke the CLI directly:

- `pnpm prisma db push` — sync schema to DB and regenerate client (preferred workflow in this repo over `migrate dev`)
- `pnpm prisma generate` — regenerate the client only
- `pnpm prisma studio` — DB GUI

**Generated Prisma client lives at `src/shared/generated/prisma/`**, not `node_modules/@prisma/client`. Import from there (e.g. `@/shared/generated/prisma/client`). The folder is committed/generated alongside source — regenerate after any `schema.prisma` change.

## Architecture

Next.js 16 App Router + React 19 + Tailwind v4 + shadcn/ui (style `new-york`, neutral base). TS path alias `@/*` → `./src/*`.

### Hexagonal layout under `src/features/<feature>/`

Each feature is organized as four layers — keep this structure when adding features:

- `domain/entities/` — plain TS types (e.g. `Todo.ts`), no framework dependencies
- `domain/repositories/` — interfaces only (e.g. `TodoRepository`)
- `application/use-cases/` — one class per use case, constructor takes the repository interface, single `execute()` method
- `infrastructure/repositories/` — concrete implementations of the domain interfaces
- `components/` — feature-specific React components

API routes (`src/app/api/**/route.ts`) are the composition root: they instantiate the use case with a concrete repo impl and call `.execute()`. Example: [route.ts](src/app/api/todos/route.ts) wires `GetTodos`/`AddTodo` to `TodoRepositoryImpl`.

### Current state to be aware of

- `TodoRepositoryImpl` is an **in-memory array**, not yet backed by Prisma — when wiring DB, swap this impl while keeping the `TodoRepository` interface stable.
- `src/app/todos/page.tsx` is a `"use client"` page using local `useState`; it does **not** call the `/api/todos` route yet.
- `src/features/users/` is an empty scaffold for a future feature.

### Shared code

- `src/shared/components/ui/` — shadcn-generated primitives (Button, Input, Checkbox). Add new ones with `pnpm dlx shadcn@latest add <name>`; `components.json` aliases route them here.
- `src/shared/lib/utils.ts` — `cn()` and other utilities
- Icons: `lucide-react`; UI primitives: `radix-ui`; class merging: `clsx` + `tailwind-merge` via `cn()`
