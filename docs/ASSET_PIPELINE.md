# Tavernborne Asset Pipeline

Tavernborne keeps gameplay and simulation code in Git while curated third-party game assets are downloaded during the build. Generated binary assets are written to `public/assets/` and are not treated as hand-authored source code.

## Sources and licensing

The first character pipeline uses the Quaternius **Universal Animation Library** from its official Godot Asset Store distribution. The pack is marked CC0 1.0 and may be used, modified and redistributed in personal and commercial projects.

Every build writes:

- `public/assets/quaternius/manifest.json` — exact source pack, selected file, license and generated public path;
- `public/assets/quaternius/LICENSES.md` — human-readable license record;
- `public/assets/quaternius/characters/universalHumanoid/model.glb` — curated runtime humanoid and animation library.

A source is never accepted silently. CI requires the license record, source status and generated GLB before running browser tests.

## Runtime architecture

`AssetHeroBody3D` is the public character renderer used by the camp and dungeon. It:

1. reads the generated manifest;
2. loads the GLB through `useGLTF`;
3. clones the skeleton per hero;
4. discovers animation clips at runtime;
5. maps simulation intentions to animation categories;
6. blends between actions;
7. applies height, width, mass, fatigue and injury modifiers from the physical body model;
8. preserves selection, dialogue and reaction overlays.

The previous procedural body is retained in `ProceduralHeroBody3D.tsx`. It is used only while an asset is loading or when a remote pack, manifest or GLB cannot be loaded. A missing asset must not corrupt the world or saves.

## Animation intentions

The initial graph supports:

- idle;
- walking and jogging;
- sleeping or sitting;
- training and combat practice;
- work and carrying;
- eating or drinking;
- talking and gestures;
- dungeon guard stance.

Clip names are discovered using normalized aliases rather than hard-coded animation indices, so another compatible Quaternius humanoid can be substituted without changing simulation code.

## Adding another pack

1. Add the official source and direct distribution URL to `scripts/install-quaternius-assets.mjs`.
2. Record the exact license.
3. Add a curated target with positive and negative filename hints.
4. Extend the generated manifest contract.
5. Add a browser assertion proving the asset is actually loaded in the game.
6. Keep a procedural or existing-asset fallback until the new source passes CI and public Pages verification.

Do not commit an asset whose source or redistribution terms cannot be established.
