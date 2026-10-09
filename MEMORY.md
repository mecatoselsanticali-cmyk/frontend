# MEMORY — admin-frontend

Always-remember facts for working in this package. Full context: `admin-frontend/CLAUDE.md` (indexed by point number — see root `AGENTS.md`). For cashier-zone work (`src/cajero/`) also read `admin-frontend/src/cajero/CLAUDE.md`.

- **One app, two zones.** Login screen (`src/pages/Login.tsx`) branches by role: admin → `/dashboard` and RBAC routes; cashier → `/cajero/*` (own module with own store, axios client, token). POS changes go in `src/cajero/`, never in the legacy `pos-frontend/` (it's been deleted from disk but still referenced in README).
- **Auth via httpOnly cookies + axios.** `withCredentials: true` on both clients (`src/services/httpClient.ts`, `src/cajero/services/httpClient.ts`). Never `localStorage`, never a manual `Authorization` header. Logout calls `POST /auth/logout` — frontend can't clear httpOnly cookies itself.
- **Session check is one-shot.** Shared `<AuthProvider>` calls `GET /auth/me` once at app load. `RequireAuth` and `RequireCashierAuth` only read that result — do not call `/auth/me` from each guard.
- **Path alias:** `@/foo` is configured in `tsconfig.json` only for this package (`./src/*`).
- **UI text rules.** Use exact button/screen labels in code, not internal names ("Carga Masiva", "Asignación Masiva de Inventario", "Finalizar turno"). If you rename anything user-facing, also update `docs/USER_MANUAL.md` in the same change.
- **Modal pattern.** Forms that edit/create a record open in a dedicated modal, not inline (point 17). Modals using `fixed inset-0` need `!m-0` or they leak margin (point 28).
- **Cashier zone UX rules.** Without an open shift, Caja/Facturas/Compras show an "Iniciar turno" notice but the user can still navigate tabs and log out — never trap them (point 31). Cashier zone is desktop-only; mobile shows `MobileBlockScreen` (point 39).
- **Stock edits:** `ManagedStockModal` (`Inventario` → "Gestionar stock") is admin-only and SETS stock to an exact value (not adds). New products can include initial stock via "+ Agregar inventario inicial" inside the create modal.
- **Filter collapse on mobile** (point 63): the 7 paginated admin pages collapse non-search filters behind a "Más filtros" modal on narrow screens — only the search bar stays visible.
- **No test runner configured.** Don't add Jest/Vitest without asking — the only test surface is backend `.test.cjs` files.
- **Build runs `tsc -b && vite build`.** TS project references are set up — check `tsconfig.json` before changing imports.