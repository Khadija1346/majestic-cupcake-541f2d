# AGENTS.md

GARRI: Rise of the Town — TanStack Start + React 19 + Tailwind 4 browser game. **Continue from PLAN.md** (milestone 1 is done).

## Layout
- `src/game/town/` — canvas town: `map.ts` (layout, buildings, NPCs, secrets), `engine.ts` (render loop, movement, collision, focus/interaction callbacks).
- `src/game/survival.ts` — pure deterministic Survival engine. Runs are fully described by (mode, seed, actions); `replay()` is the basis for server verification. Keep it pure and seeded.
- `src/game/content.ts` — districts, quests, achievements, NFTs, all driven by one `Metrics` snapshot.
- `src/lib/store.ts` — the single Citizen/progression store (localStorage today). Milestone 2 replaces `load`/`save` with Netlify Database server functions; callers must not change.
- `src/lib/config.ts` — chain, token, holder tiers, Hold & Earn rules (configurable; no APR promises).
- `src/lib/wallet.ts` — EIP-1193 non-custodial wallet; reads real on-chain balance only.
- `src/data/fixtures.ts` — all stub/demo data, labelled DEMO in UI.
- `src/routes/` — `/` town, `/survival`, `/arena`, `/quests`, `/score/$gameId`, `/citizen`, `/hub`, `/bank`, `/gallery`, `/community`, `/market`. `/mod` is linked from the town map but not built yet.

## Rules
- Keep XP, Reputation, Score, Reward Points, NFTs and $GARRI separate. Never show fake balances, transactions or minted NFTs.
- Styling uses theme tokens in `src/styles.css` (`panel`, `btn-gold`, `chip`, fonts Unbounded + Bricolage Grotesque).
