# GARRIVERSE Babylon.js Migration — Phase 1

## Decision

Use the full Babylon.js engine for the next 3D world implementation. Keep the existing WebGL prototype and the existing game/farm backend available until the new scene passes review.

Babylon.js is selected because it supports WebGL and WebGPU, scene graphs, cameras, materials, lighting, skeletal animation, physics integration, mobile virtual controls, LOD and optimization tooling. The current target is Android browsers, so the first pass uses the WebGL engine path and conservative scene settings rather than requiring WebGPU.

## Current implementation slice

The route `/world3d-babylon` is a separate, reviewable engine experiment. It includes:
- a third-person follow camera with touch drag look;
- touch movement pad and keyboard fallback;
- a village layout with roads, homes, market stalls, well, processing shed and cassava beds;
- a controllable player avatar;
- six animated village residents;
- proximity indicators for farm, market and processing areas.

The main Town HUD exposes the new route as a separate test entry. The existing `/world3d` route remains available as fallback.

## Runtime loading

The prototype currently loads the official Babylon.js browser bundle from `https://cdn.babylonjs.com/babylon.js` at runtime to avoid modifying the pnpm lockfile by hand. This is a temporary integration choice for preview evaluation, not the preferred final dependency strategy.

Before production:
1. Pin a tested Babylon.js package version in `package.json`.
2. Regenerate and commit `pnpm-lock.yaml` with pnpm.
3. Verify the build and Android browser compatibility.
4. Consider self-hosting the browser bundle if CDN availability or CSP policy requires it.

## Required next phases

1. Replace procedural placeholder geometry with licensed, optimized glTF models for Nigerian-inspired architecture, human characters, cassava plants, tools and processing equipment.
2. Add proper skeletal animations and role-based NPC schedules, pathfinding and interaction dialogue.
3. Bind farm plot visuals and harvesting/processing interactions to the existing server-authoritative farm ledger.
4. Add collisions, interaction prompts, audio/ambience, accessible settings and low-end Android quality presets.
5. Test on representative Android devices and record frame time, memory and load performance.

## Safety and release

- No token payouts, sales, staking, wagering or withdrawable rewards are implemented by this prototype.
- Do not remove the old route until the Babylon route passes visual, functional and mobile QA.
- Do not merge or deploy production without explicit owner approval.
- A successful render is not proof that the full game is complete.
