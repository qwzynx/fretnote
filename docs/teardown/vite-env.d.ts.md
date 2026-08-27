# `src/vite-env.d.ts`

**Role:** Ambient TypeScript type declarations for Vite's client-side runtime.
**Size:** 1 line. **Depends on:** the `vite` package's bundled types.

---

## Full source, annotated

```ts
/// <reference types="vite/client" />
```

**What it is:** A triple-slash directive — a TypeScript-only comment form that the compiler reads as an instruction, not as a comment. `/// <reference types="X" />` means "load the ambient type declarations from package `X` into this compilation, as if they were imported."

**Why it exists:** Vite injects globals into your code at build time that don't exist in the standard DOM or Node type definitions. Without this line, TypeScript would flag them as errors:

| Global | What it is | Where you'd hit it |
|---|---|---|
| `import.meta.env` | Vite's env-var object (`MODE`, `DEV`, `PROD`, `BASE_URL`, plus any `VITE_*`) | Any build-mode branch |
| `import.meta.hot` | The HMR API | Hot-reload code |
| `import.meta.glob` | Vite's bulk-import helper | Dynamic module loading |
| `*.css`, `*.svg`, `*.png` module shapes | Declares what a non-JS import resolves to | `import "./app/globals.css"` in `main.ts` |

That last row is the one this project actually leans on. `main.ts` line 1 imports a `.css` file. To TypeScript, `.css` isn't a module and that import is an error — until `vite/client` declares `declare module "*.css"`.

**Why a `.d.ts` and not a regular file:** The `.d.ts` extension marks it as declarations-only. It contributes types to the compilation but emits no JavaScript, so it vanishes at build time. It's picked up automatically because `tsconfig.json`'s `include` covers `src`.

**Why one line and not more:** Some projects extend this file with their own `declare module` blocks or a typed `ImportMetaEnv` interface. This project has no custom `VITE_*` environment variables — configuration lives in `lib/settings.ts` (localStorage) and the SQLite database, not in build-time env vars. So there's nothing to add.

---

## Control flow

None — it is a compiler directive. It has no runtime existence at all.

**Test of understanding:** Delete this file and run `npm run check`. The failure you get tells you exactly what it was doing.

---

## Related

- [`config/tsconfig.json`](config/tsconfig.json.md) — the `include` that pulls this file into the compilation
- [`config/vite.config.ts`](config/vite.config.ts.md) — the build tool whose types these are
- [`main.ts`](main.ts.md) — the CSS import that would break without it
