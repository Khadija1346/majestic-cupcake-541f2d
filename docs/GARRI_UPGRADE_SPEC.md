# GARRI: Rise of the Town — Upgrade Specification

## Objective
Expand Rise of the Town into a persistent, mobile-first farming and town experience that gives $GARRI meaningful gameplay utility while preserving existing working features and the current React, TanStack Start, TypeScript, Netlify, Drizzle, and Canvas architecture.

## Core gameplay loop
Prepare a plot → plant cassava stems → water and care for crops → grow through visible stages → harvest → store or process cassava → produce garri → sell, use, or reinvest in the town.

## Districts
1. Town Center — citizen services, NPCs, quests, and community board.
2. Farm District — assigned plots, soil preparation, planting, crop care, and harvesting.
3. Water District — wells, pumps, tanks, and water collection.
4. Processing District — washing, grating, fermenting, pressing, and frying cassava into garri.
5. Warehouse — persistent inventory and storage capacity.
6. Garri Market — listings, buying, selling, and market activity.

## Persistence and server authority
- Persist plots, crop states, growth timestamps, harvests, inventory, and market transactions in the database.
- Server functions validate actions and calculate rewards. Never trust client timers, localStorage, or client-submitted balances.
- Reuse existing server-authoritative validation patterns from Survival where appropriate.
- Add schema and migrations carefully, preserving existing records.
- Add ownership checks, rate limits, replay protection where relevant, and audit logs for economic actions.

## Progression and community
- Add daily and weekly tasks, NPC quests, farming leaderboards, production challenges, community goals, and achievements.
- Start with XP, reputation, and non-transferable in-game points.
- Never describe points as withdrawable or transferable tokens.

## Visual and mobile experience
- Improve the 2D Canvas experience with animated player actions, planting, watering, crop growth stages, harvesting, processing effects, NPC movement, water effects, and an immersive camera.
- Keep controls responsive on low- and mid-range Android devices.
- Test touch controls, performance, layout, loading, and errors in Android browsers and the DAO app's Capacitor WebView.

## $GARRI integration and safeguards
- Keep token utility behind a separate feature flag.
- Potential utility sinks such as plot expansion, tools, and building upgrades require explicit project approval and clear transaction flows.
- No real-token payouts, staking promises, or live wagering until contracts, distribution operations, security review, legal/compliance review, and project approvals are complete.
- Keep existing Hold & Earn and transferability settings inactive unless formally authorized.

## DAO mobile app integration
- Inspect the DAO app repository, routing, authentication, wallet provider, and build setup before choosing an integration method.
- Prefer a mobile-first embedded game route/module that feels native and avoids unnecessary external navigation.
- Reuse wallet/session context only where the existing app architecture supports it securely.
- Include loading, failure, reconnect, and poor-network states.

## Delivery sequence
1. Audit current source and identify reusable Survival farming mechanics and town systems.
2. Implement persistent farm domain model and server-validated actions.
3. Build farm, water, processing, warehouse, and market districts.
4. Add animated interactions and mobile performance improvements.
5. Test crop growth, ownership, harvest, inventory, and transaction invariants.
6. Test on a preview deployment and Android WebView.
7. Integrate with the DAO app after inspecting its architecture.
8. Merge to main and deploy only after review and verification.

## Acceptance criteria
- A player can access a plot, plant cassava, care for it, return later, and see persisted crop progress.
- Harvest and processing update server-side inventory correctly and cannot be duplicated by replaying requests.
- Water and processing locations have functional gameplay, not decorative-only interactions.
- Gameplay remains usable on Android touch screens and low/mid-range devices.
- No fake token rewards, balances, payouts, or unimplemented controls are presented as live.
- Existing working town, citizen, quest, wallet, and Survival features remain intact.
