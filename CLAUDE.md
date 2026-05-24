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

**Composition root:** Server Actions are the primary composition root — they instantiate the use case with a concrete repo and call `.execute()`. Example: [todos.actions.ts](src/features/todos/actions/todos.actions.ts) wires `AddTodo`/`UpdateTodo` to `TodoPrismaRepository` and calls `revalidatePath("/todos")` after mutating.

API Route handlers (`src/app/api/**/route.ts`) are also valid composition roots — use them **only** when there is a non-Next.js consumer (mobile app, incoming webhook, external script, OAuth callback, public API). [api/todos/route.ts](src/app/api/todos/route.ts) is kept as a reference example of the pattern but is not consumed by the frontend. Default to Server Actions for anything called from this app's frontend.

See [docs/composition-roots.md](docs/composition-roots.md) for the full decision guide between Server Actions and Route Handlers.

### Current state to be aware of

- `src/app/todos/page.tsx` is an **async Server Component** that calls `GetTodos` directly and passes Server Actions as props to the client components ([TodoInput](src/features/todos/components/TodoInput.tsx), [TodoItem](src/features/todos/components/TodoItem.tsx)). Both client components use `useTransition` for pending UI.
- `TodoPrismaRepository` is the only concrete repo implementation; the previous in-memory `TodoRepositoryImpl` has been removed.
- The Prisma client singleton lives at [src/shared/infrastructure/database/prisma/prisma.client.ts](src/shared/infrastructure/database/prisma/prisma.client.ts) — uses `@prisma/adapter-pg`, validates `DATABASE_URL`, and is gated by `import "server-only"` so accidental client imports fail the build.
- `src/features/users/` is an empty scaffold for a future feature.

### Shared code

- `src/shared/components/ui/` — shadcn-generated primitives (Button, Input, Checkbox). Add new ones with `pnpm dlx shadcn@latest add <name>`; `components.json` aliases route them here.
- `src/shared/lib/utils.ts` — `cn()` and other utilities
- Icons: `lucide-react`; UI primitives: `radix-ui`; class merging: `clsx` + `tailwind-merge` via `cn()`
