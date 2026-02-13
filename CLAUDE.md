# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Dev server with HMR (port 3000, uses tsx watch)
npm run build            # Build server + client for production
npm run lint             # ESLint (flat config, v9+)
npm run lint:fix         # Auto-fix lint issues
npm run test             # Vitest (config: config/vitest.config.ts)
npm run typecheck        # TypeScript check (no emit, uses project references)
```

Requires Node >=24, npm >=11.

## Architecture

Full-stack TypeScript karaoke party app: Koa server + React client + SQLite database, with real-time communication via Socket.io.

### Directory Layout

- `server/` — Koa HTTP server, Socket.io handlers, database access
- `src/` — React client (Redux Toolkit, CSS Modules, Webpack 5)
- `shared/` — Code shared between client and server (`actionTypes.ts`, `types.ts`)
- `config/` — Build configs (webpack, tsconfig, vitest, babel)

### Server Modules (`server/`)

Each feature follows a consistent pattern with up to three files:
- `ModuleName.ts` — Core logic (static class methods, DB queries via `sqlate`)
- `router.ts` — Koa HTTP routes
- `socket.ts` — Socket.io action handlers

Modules: Library, Media, Player, Prefs, Queue, Rooms, Scanner, User

Worker processes: `scannerWorker.ts` (media scanning), `watcherWorker.ts` (file watching), `serverWorker.ts` (Koa + Socket.io). IPC via `lib/IPCBridge.ts`.

### Client Structure (`src/`)

- `routes/` — Account, Library, Player, Queue (each is a major UI section)
- `store/modules/` — Redux slices: prefs, rooms, songInfo, status, ui, user, userStars
- `store/socketMiddleware.ts` — Bridges Redux actions to Socket.io
- `lib/socket.ts` — Socket.io client instance
- `store/Persistor.ts` — Redux state hydration from localStorage

### Socket.io Action Pattern

Actions in `shared/actionTypes.ts` prefixed with `server/` are intercepted by `socketMiddleware` and emitted via Socket.io instead of being handled locally. The server processes them and responds via callback. Non-`server/` actions are handled client-side only.

Flow: Client dispatches `server/QUEUE_ADD` → middleware emits to server → server handler in `Queue/socket.ts` processes → responds with `QUEUE_ADD_SUCCESS` or `QUEUE_ADD_ERROR` → server broadcasts `queue/PUSH` to room members.

Optimistic updates use `redux-optimistic-ui` (BEGIN/COMMIT/REVERT).

### Authentication

JWT baked into an httpOnly cookie at login time. The JWT contains `userId`, `roomId`, `isAdmin`, etc. The server validates the JWT on every socket connection (`server/socket.ts`). The `roomId` in the JWT is immutable for the session — switching rooms requires logging out and back in.

### Database

SQLite via `sqlite3`/`sqlite` packages. Schema migrations in `server/lib/schemas/`. Queries use the `sqlate` tagged template library.

### TypeScript

Two separate tsconfig profiles:
- `config/tsconfig.client.json` — module: esnext, moduleResolution: Bundler, JSX, CSS module plugin
- `config/tsconfig.server.json` — module: node16, target: es2022, `noImplicitAny: false`

Client imports use bare paths resolved by webpack (e.g., `import X from 'lib/socket'` → `src/lib/socket`). The `shared/*` alias works in both client and server.

### Styling

CSS Modules (all `.css` files are treated as modules via webpack config). No CSS-in-JS. Global styles in `src/styles/`.

### Environment Variables

Server config via `KES_`-prefixed env vars or CLI flags (see `server/lib/cli.ts`). Key ones: `KES_PATH_DATA` (database location), `KES_PORT`, `KES_URL_PATH`, `KES_SCAN`.

### ESLint

Flat config (v9+). Separate rule sets for client files (`src/`, `shared/`) with React plugins vs server files (`server/`, `config/`) with Node plugin. Uses `@stylistic` for formatting rules. Key style rules: `1tbs` brace style, space before function parens, single quotes in JSX.
