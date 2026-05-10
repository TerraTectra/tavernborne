# Tavernborne

Browser-first 2.5D idle dungeon auto-battler.

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

## Tech stack

- Vite
- React
- TypeScript
- Tailwind CSS
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

## Project rules

- No manual turn-by-turn combat as the main loop.
- Combat is real-time automated.
- Player controls systems: tavern, party, training, equipment, economy, prestige.
- Game logic must stay separate from rendering so it can later move into Tauri or another shell.
