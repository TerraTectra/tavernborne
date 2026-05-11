# Tavernborne

Browser-first 2.5D idle dungeon auto-battler.

## Web preview

After the deploy PR is merged into `main`, the public GitHub Pages build should be available at:

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

- Real-time automated combat foundation
- Sprite-based 2.5D village hub draft
- CC0 Kenney asset pipeline through npm + postinstall copy
- Centered village camera
- Y-depth sorting for clickable scene objects
- Minimal in-world selection UI
- GitHub Pages deployment workflow

## Tech stack

- Vite
- React
- TypeScript
- Tailwind CSS
- GitHub Pages
- Browser-first architecture
- Later target: Windows `.exe` via Tauri

## Development

```bash
npm install
npm run dev
```

`npm install` also runs the asset installer and copies CC0 Kenney sprites into `public/assets/kenney-hex/scene`.

To re-copy assets manually:

```bash
npm run assets:install
```

## Build

```bash
npm run build
npm run preview
```

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
