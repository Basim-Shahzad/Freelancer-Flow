# Paylancr web (Phase 1 frontend)

Next.js 15 · React 19 · TypeScript (strict) · Tailwind v4 · Radix/shadcn-style primitives.
Everything runs against a **mock layer** (zustand + localStorage). No backend is required.

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run build
```

Landing: `/` renders the variant set by `NEXT_PUBLIC_LANDING` (`global` default, or `pk`). `/pk` and `/global` are always available.
Demo: sign up or log in with any email and a password of 8+ characters; the seed data loads. Settings → Export has a "Reset demo data" action in the store (`resetDemo`).

See `docs/HANDOFF.md` for routes, tokens, the backend swap guide and known limitations, and `docs/CONVENTIONS.md` for code rules.
