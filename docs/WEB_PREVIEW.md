# Web preview checklist

## Target URL

After the deployment workflow is merged into `main` and completes successfully, the site should be available here:

```text
https://terratectra.github.io/tavernborne/
```

## Merge order

This repository currently uses stacked PRs:

1. Merge PR #1: project foundation and first prototype.
2. Merge PR #2: sprite-based village scene pipeline.
3. Merge the GitHub Pages deployment PR.

## GitHub Pages setting

If the workflow runs but the site does not appear, open:

```text
Repository -> Settings -> Pages
```

Set:

```text
Build and deployment -> Source -> GitHub Actions
```

## Local verification

```bash
npm install
npm run assets:install
npm run build
npm run preview
```

## Common problems

### 404 on GitHub Pages

Check that `vite.config.ts` contains:

```ts
base: '/tavernborne/'
```

GitHub Pages serves project repositories from a subpath, not from the domain root.

### Sprites do not appear

Run:

```bash
npm run assets:install
```

Then confirm this generated file exists:

```text
public/assets/kenney-hex/scene/manifest.json
```

### PR preview

This workflow builds pull requests to catch errors, but it only deploys the public website from `main`.
