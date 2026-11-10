# GARRIVERSE 2026 — Living World Upgrade

## Product vision

Transform **GARRI: Rise of the Town** from a compact walkable town into a mobile-first, Nigerian-inspired living-world game. The player should experience a connected world with believable residents, useful places, visible farming and production, and activities that change the environment. This is an evolution of the existing React 19 + TypeScript + HTML5 Canvas game, not a framework rewrite.

## Current baseline (verified in repository)

- The home route renders `TownView`, which owns the Canvas lifecycle and connects the UI to `TownEngine`.
- `TownEngine` currently builds a 64 × 48 tile world, draws buildings/roads/trees/NPCs, follows the player with a camera, handles collisions and interaction focus, and animates a small set of NPCs.
- NPCs currently wander randomly around fixed home points; they do not have schedules, jobs, destinations, or meaningful world tasks.
- The Farm District currently lives at `/farm` as a separate dashboard with four plot cards and server-backed plant/water/harvest/process actions. It is not yet rendered as a walkable farm landscape inside the Canvas world.
- The existing farm actions and database persistence should be preserved and connected to the world interaction layer rather than replaced with client-only demo state.

## Experience pillars

1. **A world that feels inhabited** — residents follow simple daily routines, move between valid destinations, pause for work, react to nearby players, and use short contextual dialogue.
2. **A farm that is part of the world** — a visible, explorable farm district with prepared soil, multiple crop rows, water infrastructure, growing cassava stages, workers, paths, storage and a processing compound.
3. **A satisfying production loop** — prepare land → plant stems → water/care → wait for visible growth → harvest tubers → process cassava → produce garri → store or trade in-game.
4. **A connected town economy** — the market, farm, processing shed, warehouse and player inventory share authoritative server-backed resource state.
5. **Premium mobile feel** — responsive camera, readable controls, clear interaction prompts, touch targets, efficient rendering, reduced-motion/accessibility options and reliable performance on mid-range Android devices.
6. **Authentic Nigerian visual identity** — locally grounded architecture, compounds, market stalls, farms, water points, transport, clothing and environmental details. Avoid generic fantasy assets that do not fit the setting.

## Technical direction

- Keep the current stack: React 19, TypeScript, TanStack Start, HTML5 Canvas and Netlify.
- Keep simulation and rendering separated. The engine owns world simulation; React owns menus, HUD, dialogue, accessibility and route transitions.
- Introduce typed world entities and systems rather than adding more unrelated drawing code to one class:
  - world/map data and district boundaries
  - entity registry and deterministic entity IDs
  - NPC behaviour state machine and navigation targets
  - crop/farm visual state derived from authoritative farm records
  - interaction registry mapping world objects to existing server actions
  - camera, animation and render layers
- Use a fixed or capped simulation timestep, delta-time movement, camera smoothing, viewport culling and device-pixel-ratio-aware canvas sizing.
- Use deterministic seeded decoration and stable NPC schedules where possible. Avoid random behaviour that makes interactions unreliable.
- Preserve collision boundaries and ensure NPC path targets cannot place residents inside buildings, water, crops or out-of-bounds areas.
- Do not introduce a new heavy game framework or WebGL dependency unless a measured performance/feature requirement justifies it.

## World layout

### Central town
Retain the existing plaza as the social anchor. Improve roads, sidewalks, lighting, signage, compounds, doors, market activity and landmarks. Add more residents only after navigation and performance are stable.

### Farm District
Expand beyond the current small garden area into a dedicated district connected by a road and gate. Include:
- several visible cultivation blocks with soil beds and individual planting rows
- plot boundaries and readable crop growth stages (prepared soil, planted stem, sprout, leafy growth, mature plant, harvested soil)
- a well or water tank, irrigation channels and water-pump interaction
- a tool/store shed and cassava collection point
- a processing compound with washing, peeling, grating, pressing, sieving, roasting and bagging stations
- a warehouse and route to the market

### Market and production chain
The market should display produce and garri stock that comes from the shared inventory. Trade actions must validate stock and prices on the server. Any market price changes must be visible and explainable.

## NPC behaviour model

Each NPC should have:
- stable identity, role, home position and allowed work areas
- a state such as idle, walking, working, talking, resting or reacting
- a schedule with time windows and destinations
- a valid path target and collision-aware movement
- interaction dialogue tied to role and current task
- a safe fallback to idle if no valid route exists

Start with a small representative group: farmer, water carrier, processor, market trader, town guard and resident. Scale population only after mobile performance tests.

## Farm gameplay integration

- Keep `getFarm` and `farmAction` as the authoritative source for farm state.
- The Canvas must render plot and crop appearance from server-returned plot state and timestamps; it must not invent growth or inventory.
- Interacting with a world plot opens a contextual action panel and invokes the existing server action.
- On success, refresh the authoritative farm state and update the world view.
- Handle loading, network failure, duplicate taps, stale state and unavailable citizen sessions.
- Clearly label all resources as in-game items. Do not imply cash, withdrawable token rewards, staking yield or real-money value.

## Visual and interaction quality bar

- Distinct foreground, midground and background layers with correct depth sorting.
- Consistent character scale, animation timing, shadows and readable silhouettes.
- Environmental motion: tree sway, water movement, smoke/steam, market activity and subtle ambient particles.
- Day/evening lighting can be added after core navigation and farm rendering work reliably.
- Contextual prompts must identify the object and available action; no dead buttons.
- Every interactive control needs loading, success and failure feedback.
- The game must remain playable on a narrow Android viewport without HUD overlap or controls blocking key interaction areas.

## Delivery phases

### Phase 0 — Foundation and safety
- Keep this work on `feature/garriverse-2026-living-world`.
- Preserve the current production branch and farm database/actions.
- Add typed boundaries between world data, simulation, rendering and React UI.
- Establish a repeatable build/type-check and manual mobile test checklist.

### Phase 1 — Living town foundation
- Improve district scale and visual composition.
- Add path-aware NPC routines and role-based idle/work animations.
- Add readable interaction states and collision-safe navigation.
- Verify camera bounds, resize, touch controls and performance.

### Phase 2 — Walkable farm world
- Build a large farm district into the Canvas map.
- Render soil beds, rows, irrigation, shed and processing compound.
- Connect world plots to existing server farm records/actions.
- Show crop growth stages based only on persisted timestamps/state.

### Phase 3 — Production and market loop
- Add processing station interactions and server-validated inventory conversion.
- Connect produced garri to warehouse and market stock.
- Add trader NPC routines and explainable in-game trading.

### Phase 4 — Polish and integration readiness
- Add day/evening ambience, sound controls, accessibility and reduced motion.
- Test Android touch, low-memory devices, resize/orientation and network interruptions.
- Document the Canvas embed contract for the DAO app's web module/Capacitor container.

## Acceptance criteria

A phase is not complete merely because a route or button exists. It must pass all applicable checks:
- production build and TypeScript checks pass
- no console errors during the tested flow
- player can reach and interact with every new world feature
- collisions prevent walking through buildings, water and solid objects
- NPCs move only through valid walkable areas and recover from blocked routes
- farm visuals match server state after refresh and on a second session
- actions cannot create negative stock, duplicate harvests or unsupported rewards
- loading, offline/error and retry states are usable
- mobile controls and HUD remain usable at common Android screen sizes

## Explicit non-goals for this upgrade

- No real-money payouts, token transfers, staking promises or live wagering.
- No fake wallet balances, fake leaderboards or fabricated multiplayer population.
- No replacing the existing farm backend with local-only state.
- No production merge until the preview has been tested and the acceptance criteria are met.

## First implementation target

Deliver **Phase 1's first vertical slice**: a small set of scheduled, collision-aware role-based NPCs with visible work/idle states and a robust navigation fallback. Then implement the walkable Farm District as a second vertical slice, reusing the existing server-backed farm system.
