# GARRIVERSE 2026 — Master Build Prompt

> Use this as the single product and engineering brief for the next GARRIVERSE implementation phases. The repository is the source of truth; inspect it before changing code.

## Mission

Evolve **GARRI: Rise of the Town** into a polished, mobile-first, Nigerian-inspired living-world farming game. The result must feel like a real game world with purposeful movement, visible work, useful NPCs, and a satisfying cassava-to-garri production chain—not a static 3D diorama, a collection of cards, or a set of decorative buttons.

## Mandatory first steps

1. Inspect the current branch, open pull requests, latest commits, package scripts, route structure, game engine, farm schema/actions, and existing preview before editing.
2. Reuse the existing React, TypeScript, TanStack Start, Canvas/game-engine, database, and Netlify architecture. Do not rewrite the app or introduce a heavy engine/dependency without a documented technical reason and measured benefit.
3. Preserve all working production features and the existing server-authoritative farm ledger. Do not overwrite newer work.
4. Work only on the designated feature branch and its pull request. Never commit directly to `main`, merge a PR, change production data, or deploy production unless the owner explicitly authorizes it.

## Player experience

Build a connected, explorable Nigerian village with:
- a central town square and readable road network;
- residential compounds and recognizable local architecture;
- a lively market with stalls, traders and stored produce;
- a substantial walkable cassava farm with separate cultivation plots and visible rows;
- water well/tank, pump, irrigation channels, tool shed and crop collection point;
- a processing compound with washing, peeling, grating, pressing, sieving, roasting and bagging stations;
- a warehouse and a clear route connecting farm, processing and market.

The camera should provide a stable third-person/isometric game perspective appropriate to the existing engine. Use layered scenery, coherent scale, lighting, shadows, textured/varied surfaces and environmental animation. Avoid crude placeholder blocks as the final art direction. If high-fidelity assets are unavailable, create a consistent polished stylized 3D/2.5D visual language and document the asset gap instead of pretending realism has been achieved.

## Living NPCs

Start with a small, performant population: farmer, water carrier, processor, trader, guard and resident. Each NPC needs:
- stable identity, role, home and permitted work locations;
- a deterministic daily schedule and meaningful destinations;
- states such as idle, walking, working, talking, resting and reacting;
- collision-aware navigation on valid paths;
- visible role-appropriate work/idle animation;
- short contextual dialogue or interaction;
- a safe idle fallback when blocked or unable to find a route.

NPCs must visibly move and perform tasks. Do not count stationary figures as a living population. Do not fabricate multiplayer players or online population.

## Farming and production gameplay

Implement a clear, playable loop:

1. Prepare a plot/soil.
2. Plant cassava stems.
3. Water or care for crops.
4. Show crop growth stages over time.
5. Harvest mature cassava.
6. Carry/transfer harvest to the processing compound.
7. Operate the processing stations in a logical sequence.
8. Produce garri and store it in the warehouse.
9. Show available stock at the market; only enable in-game trade when server validation, price rules and inventory accounting are implemented.

Keep `getFarm` and `farmAction` as the authoritative source of farm state. The world renderer must display persisted state and timestamps, not invent local inventory or crop growth. Validate all actions on the server, protect against duplicate taps, stale versions, negative stock and race conditions. Provide clear loading, success, empty, offline and retry states.

## Mobile quality

Design and test for Android first:
- touch movement controls with large targets and no accidental page scrolling;
- drag-to-look/camera controls that do not conflict with movement;
- responsive HUD and panels for narrow screens and landscape/portrait changes;
- capped pixel ratio, delta-time movement, viewport culling and bounded entity counts;
- readable text, safe-area spacing, reduced-motion option and sound toggle;
- graceful WebGL/Canvas fallback and recovery from network interruption.

## Architecture and code quality

Keep simulation, world data, rendering, interactions and React UI separated. Prefer typed entities/systems, deterministic IDs and seeded decoration. Use delta-time or a capped fixed timestep, collision-aware pathfinding, camera smoothing and stable interaction targets. Avoid giant monolithic route components. Add tests for pure simulation/action logic where practical.

Every visible control must do what its label promises. No dead buttons, fake balances, fabricated leaderboards, decorative-only gameplay claims or silent failures.

## Economy and safety boundaries

All initial resources are clearly labelled **in-game items**. Do not implement or imply:
- real-money earnings or withdrawable rewards;
- $GARRI transfers, payouts, staking yield or token rewards;
- live wagering, betting or prediction-market settlement;
- fake wallet balances, fake market sales or fake multiplayer population.

Any future token-linked feature requires explicit product-owner approval, audited server-side design, security review and applicable compliance review. Until then, keep token integrations disabled and state this clearly in the UI.

## Delivery sequence

### Phase 1 — Living town
Build role-based NPC schedules, valid navigation, movement/work animations, dialogue and robust fallbacks. Verify collisions, camera, resize and mobile controls.

### Phase 2 — Walkable farm district
Expand the farm into a connected landscape with cultivation rows, soil/crop stages, irrigation, tools, workers, collection point and processing compound. Bind every plot to the existing farm ledger.

### Phase 3 — Processing chain and warehouse
Implement meaningful station interactions and server-validated inventory transformations. Persist all results and provide clear error/retry feedback.

### Phase 4 — Market and polish
Connect market stock to the same inventory. Add explainable in-game trade only after server-side validation and accounting. Add ambience, lighting, accessibility and DAO-app/Capacitor embed documentation.

## Required workflow for every implementation slice

1. State the exact user-facing outcome and acceptance criteria.
2. Inspect affected files and current branch state.
3. Implement one coherent vertical slice; keep changes reviewable.
4. Run the repository's actual install/build/typecheck/lint/test/database checks that are available. Do not report a check as passed unless it was executed and its result was observed.
5. Review the diff for regressions, dead controls, unsafe economy claims, accessibility and mobile layout.
6. Publish/update the feature-branch preview and record the exact preview URL.
7. Provide a concise manual Android test checklist and clearly mark anything not verified.
8. Update the pull request with changes, checks, preview and known limitations. Keep it open and unmerged pending owner review.

## Definition of done

A phase is complete only when:
- production build and TypeScript checks pass;
- no console/runtime errors occur in the tested flow;
- the player can reach and use each new feature;
- collision and NPC navigation behave correctly;
- farm visuals and inventory match persisted server state after refresh;
- actions cannot duplicate rewards or create negative inventory;
- loading, offline, error and retry states work;
- common Android screen sizes remain playable;
- preview evidence and known limitations are recorded.

**Do not call a prototype a finished game. Do not merge or deploy production without explicit approval.**
