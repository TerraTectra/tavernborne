# Tavernborne

Browser-first 2.5D idle dungeon auto-battler.

## Current direction

Tavernborne is a spiritual successor to tavern-management and endless-expedition RPGs, without using protected names, assets, text, UI, or worldbuilding from other games.

Core loop:

```text
tavern -> heroes -> real-time auto expedition -> loot -> upgrades -> deeper floors -> prestige
```

## Current prototype

- Real-time automated combat
- 2.5D top-view arena
- localStorage save/load
- Tavern upgrades
- Hero training and hiring
- Loot drops
- Early prestige draft

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

## Build

```bash
npm run build
npm run preview
```

## Project rules

- No manual turn-by-turn combat as the main loop.
- Combat is real-time automated.
- Player controls systems: tavern, party, training, equipment, economy, prestige.
- Game logic must stay separate from UI so it can later move into Tauri or another shell.
