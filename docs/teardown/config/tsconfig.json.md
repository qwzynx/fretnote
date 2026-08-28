# `tsconfig.json`
**Role:** TypeScript compiler configuration for type-checking (`npm run check`).

**`"noEmit": true`** — TypeScript never produces output here. **esbuild (inside Vite) does the actual transpilation**, stripping types without checking them. So `tsc` is purely a *linter* in this project, and the build will happily succeed with type errors. `npm run check` (svelte-check) is the gate that catches them.

**`"strict": true`** — the umbrella flag enabling `strictNullChecks`, `noImplicitAny`, and the rest. This is why the codebase is full of `?? undefined`, `!== undefined` guards, and explicit `| null` returns — the null-handling discipline visible in [`db.ts`](../lib/db.ts.md) and [`transpose.ts`](../lib/music/transpose.ts.md) exists because this flag forces it.

**`"moduleResolution": "bundler"`** — the modern mode that mirrors how Vite resolves: extensionless imports, `package.json` `exports` maps. Required for `import x from "sql.js/dist/sql-wasm.wasm?url"` to resolve.

**`"verbatimModuleSyntax": true`** — enforces that type-only imports are written `import type`. That's why [`db-driver.web.ts`](../lib/db-driver.web.ts.md) writes `import { type Database as SqlJsDatabase }` and `import type { SqlDriver }`: without the annotation, the import would survive into the JS output and create a **runtime circular dependency** between the two driver files. The flag turns a subtle bug class into a compile error.

**`"isolatedModules": true`** — every file must be transpilable alone, which is what esbuild requires. Rules out `const enum` and re-exporting a type without `export type`.

**`"paths": { "@/*": ["./src/*"] }`** — the type-checker's half of the alias. **[`vite.config.ts`](vite.config.ts.md) declares the same mapping independently**; both must agree.

**`"skipLibCheck": true`** — don't type-check `node_modules`. Standard, and a large build-time saving.

**`"include": ["src", "vite.config.ts"]`**, **`"exclude": [..., "src-tauri"]`** — `src-tauri` is Rust. Note **`scripts/` is not included**, so the three `.mjs` scripts are never type-checked (and [`eslint.config.mjs`](eslint.config.mjs.md) ignores them too).

**Related:** [`vite.config.ts`](vite.config.ts.md), [`vite-env.d.ts`](../vite-env.d.ts.md), [`eslint.config.mjs`](eslint.config.mjs.md)
