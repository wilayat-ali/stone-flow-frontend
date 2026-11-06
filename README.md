# Stone Flow Frontend

Next.js 16 · React 19 · Tailwind v4 · shadcn/ui · next-intl (English + Urdu/RTL) · TanStack Query/Table

```bash
npm install
npm run dev        # http://localhost:3000  (redirects to /en/login)
npm run lint       # includes the no-hardcoded-colors / RTL-safety rule
npm run typecheck
```

## Rules

1. **No hard-coded colors.** Colors live only in `src/app/globals.css` (theme: Tangerine, shadcnthemer).
   Use semantic tokens: `bg-primary`, `text-muted-foreground`, `border-border`, `fill-chart-1`, `bg-success`...
   Lint fails on hex, `oklch()/rgb()/hsl()` and Tailwind palette classes (`bg-red-500`).
2. **RTL-safe classes only.** `ms-/me-/ps-/pe-`, `start-/end-`, `text-start/end`.
   Lint fails on `ml-/mr-/pl-/pr-/left-/right-`.
3. **Shared components have no text.** Labels come in via props; feature components call `useTranslations`.
4. **Every UI string lives in** `src/messages/{en,ur}.json`. Keys are type-checked against `en.json`.

## Layout

```
src/app/[locale]/        (auth) (workspace) (app) s-admin/{auth,(portal)}
src/components/ui        shadcn primitives (regenerate with `npx shadcn add`)
src/components/shared    StatCard, DataTable, ResourcePage, ConfirmDialog, form fields ...
src/components/layout    AppShell, nav, workspace switcher, user menu, language/theme toggles
src/features             per-domain data, schemas, server actions
src/config               routes, cookie names, nav config
src/proxy.ts             i18n + auth/workspace route guard
```

## Add an admin module in ~40 lines

Copy `src/components/admin/roles-page.tsx`: define columns, fields, a zod schema and an API
(`createMockApi` today, real `fetch` later) and pass them to `<ResourcePage />`.

## Mock parts to replace

- `src/features/auth/actions.ts` and `src/lib/session.ts`: cookie-based fake session.
- `src/lib/mock-api.ts`, `src/features/**/data.ts`: in-memory data.
