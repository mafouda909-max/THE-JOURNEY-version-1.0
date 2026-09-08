# THE JOURNEY / الرحلة — mobile companion app

Expo (React Native) client for travelers: browse published offers, read verified
agents, and send a contact request. It talks to the same Next.js API as the web
app — no separate backend, no duplicated data model.

This is a **foundation** release, deliberately scoped:

| In scope | Out of scope (for now) |
| --- | --- |
| Read published offers + verified agents | Agent/admin write flows |
| Contact-request submission with server-matching validation | Authenticated sessions (see *Why there is no login*) |
| Stale-while-revalidate cache for flaky connections | Push notifications, deep links, offline write queue |
| Service status screen reading `/api/health` | Native biometrics, payments |

## Run it against a local API

```bash
# 1. start the web app (the API lives inside it)
npm ci && npm run dev          # repo root, http://localhost:3000

# 2. start the mobile app
cd mobile && npm ci && npm start
```

Press `a` / `i` for an emulator or scan the QR code with Expo Go. The API origin
is derived from the Metro packager host, so a device on the same network reaches
the dev server without any configuration. Android emulators can instead export
`EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000`.

For staging/production, set the origin explicitly — one of:

- `expo.extra.apiBaseUrl` in `mobile/app.json` (per release profile), or
- `EXPO_PUBLIC_API_BASE_URL=https://api.<your-host>` at build time.

The client **refuses to guess**: with neither set, every screen shows a setup
panel explaining how to point the app at a server (`src/lib/config.ts`).

## Commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` against the Expo base config |
| `npm test` | Node test runner over the pure modules (no emulator needed) |
| `npm run bundle` | Metro bundle for iOS (`expo export`) — catches unresolvable imports |
| `npm run verify` | All three, the same set the `mobile` CI job runs |
| `npm start` | Expo dev server |

From the repo root: `npm run mobile:verify`.

## Layout

```
src/
  api/client.ts       typed fetch: timeouts, jittered GET retries, error mapping
  api/endpoints.ts    every route + verb the app uses (contract-tested against src/app/api)
  api/types.ts        response mirrors + parsers that narrow untrusted JSON
  lib/config.ts       API origin resolution (app config → env → Metro host)
  lib/cache.ts        TTL / stale-while-revalidate over an injected key-value store
  lib/format.ts       Arabic-first formatting, mirrored from src/lib/format.ts
  lib/validation.ts   contact-form rules mirrored from the API
  lib/runtime.ts      RN glue: Expo constants + AsyncStorage
  hooks/              useApiResource (cache-first loading state machine)
  screens/            Offers, Offer detail, Agents, Status
tests/                Node test runner suites for the pure modules
```

Deliberate choices worth knowing before you change them:

- **No `Intl`.** Hermes' ICU support varies by build, so digit/date formatting is
  implemented locally (`src/lib/format.ts`) and unit-tested.
- **`POST` is never auto-retried.** A retried contact request would insert a
  duplicate lead; only idempotent `GET`s retry, with jittered backoff.
- **No extra safe-area module.** Top inset comes from `StatusBar.currentHeight`
  on Android and a constant on iOS. Swap in `react-native-safe-area-context` if
  the app ever needs per-edge insets.
- **RTL is styled per-view** (`writingDirection: "rtl"`), not via
  `I18nManager.forceRTL`, which needs a native relaunch and is unreliable in
  Expo Go.

## Why there is no login

The web session is a `tj_sess` **httpOnly cookie** (`src/lib/identity.ts`).
React Native's `fetch` does not persist cookies across requests, and the
tempting shortcut — accepting the session token in an `Authorization` header —
would put a long-lived credential into JS-reachable storage on the device and
widen the API's attack surface for a read-only client. That trade-off deserves
its own review, so the mobile app is limited to endpoints the web app also
serves unauthenticated, and the write path is only the public contact form.

## Verification status

`npm run verify` passes locally (typecheck, 76 unit tests, Metro bundle over 604
modules). Not verified here, and needing a device or simulator: visual layout,
gesture/pull-to-refresh feel, image loading on throttled networks, and RTL
behaviour on an Arabic-locale device.

## Drift protection

`tests/mobile-contract.test.ts` (root suite) reads this package as text and
asserts that:

- every route in `src/api/endpoints.ts` exists under `src/app/api/**` and exports
  the declared verb,
- trip types, currencies, price labels, verification/health status unions match
  the server,
- the contact-form limits and Arabic refusal copy match
  `src/app/api/contact-requests/route.ts`,
- every `offers`/`agents` column the API returns is modelled in
  `src/api/types.ts`, while internal moderator fields (`rejectionReason`) stay out,
- no deployment hostname is hard-coded in the client.

If you change a server contract, that test fails in CI — fix the mobile side in
the same PR.
