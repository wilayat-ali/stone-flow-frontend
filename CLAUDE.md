# Stone Flow Frontend — project context

@AGENTS.md

SaaS frontend (login → workspace → app, plus Admin Center and Super Admin). Built from `D:\hobby\next-starter-app`
(auth forms / structure) with the flow modelled on `D:\my-projects\auditvare-dev-frontend`
(`/admin-center`, `/s-admin`, workspace selection). Everything here was decided in the original chat; this file is the handoff.

## Commands

```bash
npm run dev         # http://localhost:3000 -> /en/login (Turbopack)
npm run lint        # includes the no-hardcoded-colors / RTL rule (see below)
npm run typecheck
npm run build
```

Test logins (auth is a mock, any values that pass validation work):
- App: `admin@stoneflow.com` / `Password123`, OTP `123456` (any 6 digits), then pick any workspace.
- Super admin: `/en/s-admin/auth/login`, `superadmin@stoneflow.com` / `Password123`, no OTP.

## Stack

Next.js 16 (App Router, `src/proxy.ts` not middleware) · React 19 · Tailwind v4 · shadcn/ui (regenerated from the CLI, new-york) ·
next-intl 4 (English + Urdu/RTL) · TanStack Query + Table (v8 API) · react-hook-form + zod · dnd-kit · Recharts · next-themes · Sonner · lucide-react.

## Hard rules (the user's requirements)

1. **No hard-coded colors, ever.** All colors come from the theme in `src/app/globals.css`
   (Tangerine, https://shadcnthemer.com/themes/44dec9b0-4404-4ded-9c7f-8f2a74a18efb). Use semantic tokens only
   (`bg-primary`, `text-muted-foreground`, `border-border`, `fill-chart-1`, `bg-success`, `var(--primary)` in chart config).
   `globals.css` also defines extras not in the export: `success`, `warning`, `info` (+ foregrounds), `destructive-foreground`, `overlay`.
2. **Every component reusable.** Shared components take data/labels via props and contain no text. Feature components call `useTranslations`.
3. **English + Urdu.** All UI strings in `src/messages/{en,ur}.json`; keys are type-checked against `en.json`
   (`src/types/next-intl.d.ts`). Add every new key to **both** files. Urdu text was written by Claude and needs native review.
4. **RTL-safe classes only**: `ms-/me-/ps-/pe-`, `start-/end-`, `text-start/end`, `rtl:rotate-180` on directional icons.
5. Match the theme preview exactly (dashboard-01 look). Don't restyle components away from the shadcn block markup.

`eslint-rules/no-hardcoded-styles.mjs` enforces 1 and 4 (hex, `oklch()/rgb()/hsl()`, palette classes like `bg-red-500`,
`ml-/mr-/pl-/pr-/left-/right-/text-left`). It is relaxed for `src/components/ui/**` (direction only, side-driven sidebar/sheet/drawer)
and off for `ui/chart.tsx` (Recharts attribute selectors). Lint must stay clean.

## Structure

```
src/app/[locale]/
  (auth)/            login (+OTP step), signup, forgot-password, set-password
  (workspace)/       select-workspace
  (app)/             layout (guard) -> dashboard, admin-center/{overview,users,roles}
  s-admin/auth/login, s-admin/(portal)/{home,workspaces}
src/components/ui         shadcn primitives (regenerate with `npx shadcn@latest add <x> -o`, then re-check rules)
src/components/shared     StatCard(+StatCardGrid), DataTable, TablePagination, ResourcePage, ConfirmDialog, form-fields, EmptyState, StatusBadge, PageHeader
src/components/layout     AppShell, AppSidebar, NavMain, WorkspaceSwitcher, UserMenu, LanguageSwitcher, ThemeToggle, Brand
src/components/dashboard  ChartAreaInteractive, DocumentsTable, DashboardView
src/features              auth (actions, schemas), workspace, dashboard (sample data), admin, super-admin, resource-labels
src/config                auth.ts (routes, cookie names), nav.ts (sidebar config: add nav items here)
src/proxy.ts              i18n + route guard (session -> workspace -> page; separate s-admin cookie)
src/i18n                  routing (locales en/ur, always-prefixed), navigation, request
```

Adding an admin CRUD module (~40 lines): copy `components/admin/roles-page.tsx` (columns + fields + zod schema + api) into `<ResourcePage />`,
add messages in the shared resource shape (`title, description, create, createTitle, editTitle, deleteTitle, deleteDescription, created, updated, deleted`),
add the route + a `config/nav.ts` entry.

## Design decisions made along the way

- **Sidebar**: shadcn `sidebar-07` markup (team switcher, nav, user menu, rail) with `variant="inset"` and `collapsible="icon"`
  (collapses to an icon rail; chosen over offcanvas). A custom-built sidebar glitched earlier, so keep to stock block markup.
  `SidebarContent` has `overflow-x-hidden` (fixed a horizontal scrollbar during collapse). Sidebar flips to the right in Urdu.
- **Layout shell**: dashboard-01 look (`--sidebar-width: 18rem`, `--header-height: 3rem`). The inset card is the scroll container and the header
  is `sticky top-0` inside it (page itself doesn't scroll). Content wrapper is `@container/main` (the block's container queries depend on it).
- **Dashboard**: dashboard-01 components using the block's real sample data (`features/dashboard/data.ts`, `documents.ts`).
  Chart area colors both use `var(--primary)`; time axis is forced LTR in Urdu.
- **Form fields** match the reference: `border-input bg-input/30` (very faint by design). Sheet/Dialog/AlertDialog/Drawer surfaces use `bg-card` (white)
  so fields are legible, as in the reference cards. The page-level search sits on the grey page so it looks fainter.
- Icons are lucide (the block uses tabler); the documents-table detail drawer has no chart; the block's Quick Create / Documents nav / Settings-Help-Search
  items were intentionally not added (no such pages).
- Dev indicator disabled (`devIndicators: false`) because it covered bottom-right controls.
- Urdu font: Noto Naskh Arabic via `next/font` (`--font-urdu`); digits are Western (Intl default for `ur`).

## Mock parts to replace with the real backend

- `src/features/auth/actions.ts` + `src/lib/session.ts`: cookie-based fake session (`sf_session`, `sf_workspace`, `sf_admin_session`).
- `src/lib/mock-api.ts` (`createMockApi`) and `src/features/**/data.ts|users.ts|roles.ts|workspaces.ts`: in-memory data with the same shape as `ResourceApi`.
- Login/signup/forgot/set-password forms simulate the API with a timeout.

## Status

Typecheck + lint clean; `next build` passed earlier (before the dashboard/sidebar rewrite, so re-run it). Verified in the browser:
dashboard, collapsed/expanded sidebar (no horizontal scroll), sticky header, Users add-sheet. **Not yet visually verified**: Urdu/RTL pages, dark mode
for the new components, Roles/Workspaces/super-admin pages, mobile widths.

## Next steps (open)

- Optional header polish: shadow when scrolled; a slot so each page can put its primary action in the sticky header; sticky table headers.
- Connect the real auth + API (replace the mock parts above), add real permission checks (`<Can>` helper was planned, not built).
- Verify RTL/dark mode/mobile; run `npm run build`; native Urdu review of `src/messages/ur.json`.
- Not done on purpose: SignalR/real-time, git init/commit (no repo yet), Sentry/Turnstile (removed from the starter).

## Gotchas

- Next 16: `params` are Promises, `proxy.ts` replaces middleware; read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).
- When regenerating shadcn components, re-apply: logical (RTL) classes, `bg-overlay`/`text-destructive-foreground` tokens, the `Math.random`
  lint fix in `SidebarMenuSkeleton`, and `border-input bg-input/30` on Input/Textarea/SelectTrigger.
