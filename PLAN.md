# GARRI: Rise of the Town — Roadmap

1. **Playable town & core loop (done)** — Walkable canvas town (11 districts, NPCs, secrets, tutorial, map, joystick), Citizen creation/GARRI ID, GARRI SURVIVAL (deterministic seeded engine, 3 modes), Score Cards with share links, Arena (Daily/Weekly/Season/All-Time), Quest Board (all 7 categories, 5 states), Player House, Citizen Hub referrals, Bank with real non-custodial wallet balance read, NFT Gallery eligibility, Community Hub, Market preview. Progress persists on-device via `src/lib/store.ts`.
2. **Database persistence** — Netlify Database (Drizzle) tables: citizens, games, quest_claims, achievements, referrals, nft_eligibility, reward_ledger. Swap `load`/`save` in `src/lib/store.ts` for server functions.
3. **Citizen accounts** — Netlify Identity sign-in so a GARRI ID follows a player across devices; moderator role.
4. **Server score verification** — Submit (mode, seed, actions); server runs `replay()` from `src/game/survival.ts` and sets `verified/rejected`. Global leaderboards replace `DEMO_BOARD` in `src/data/fixtures.ts`; public Game ID lookup.
5. **Mod Hub (`/mod`)** — Moderator-only search of Game IDs, review queue for scores, referrals, rewards and NFT eligibility (stub queue in `fixtures.ts`).
6. **Referral ledger & anti-abuse** — Server-side PENDING → QUALIFIED → REWARDED, device/IP heuristics, self-referral blocks.
7. **Rewards & Hold & Earn** — Server-configured reward rules (`src/lib/config.ts`), balance snapshots, reward history linked to Robinhood Chain transactions.
8. **NFT minting** — Citizen Collection contract on Robinhood Chain (4663), mint from reserved eligibility.
9. **Market & new mini-games** — RP-spendable cosmetic stalls; Ayo, Okada Rush, Suya Stack, Danfo Driver.
