# Tavernborne

Browser-first 3D idle dungeon auto-battler prototype.

## Web preview

Public GitHub Pages build:

```text
https://terratectra.github.io/tavernborne/
```

If the page is not live yet, open repository settings and set:

```text
Settings -> Pages -> Build and deployment -> Source: GitHub Actions
```

See `docs/WEB_PREVIEW.md` for the exact checklist.

## Current direction

Tavernborne is a spiritual successor to tavern-management and endless-expedition RPGs, without using protected names, assets, text, UI, or worldbuilding from other games.

Core loop:

```text
tavern -> heroes -> real-time auto expedition -> loot -> upgrades -> deeper floors -> prestige
```

## Current prototype

- Stylized 3D village hub
- Fixed 3/4 top-side camera
- Approved Quaternius/Godot Store asset pipeline
- Central tavern composition
- Warm tavern / forge / dungeon lighting
- Hover and selection feedback for buildings
- Legacy sprite-based village kept as fallback, but no longer used as the main entry
- GitHub Pages deployment workflow

## Approved asset packs

The active asset installer only uses approved CC0 Quaternius packs from Godot Asset Store:

```text
Medieval Village MegaKit
Fantasy Props MegaKit
Stylized Nature MegaKit
```

The packs are downloaded during `npm run assets:install`, extracted into `.asset-cache`, curated into `public/assets/quaternius`, and then used by the web build.

## Tech stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Three.js
- React Three Fiber
- Drei helpers
- GitHub Pages
- Browser-first architecture
- Later target: Windows `.exe` via Tauri

## Development

```bash
npm install
npm run assets:install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

`npm run build` also runs the approved asset installer before `tsc` and `vite build`.

## Deploy

GitHub Actions deploys the production build from `main` to GitHub Pages.

Manual local production check:

```bash
npm run build
npm run preview
```

## Project rules

- No manual turn-by-turn combat as the main loop.
- Combat is real-time automated.
- Player controls systems: tavern, party, training, equipment, economy, prestige.
- Game logic must stay separate from rendering so it can later move into Tauri or another shell.
- New assets, textures, models, shaders, UI kits, icons, or sounds must be approved by the project owner before integration.
