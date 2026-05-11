# Web preview checklist

## Target URL

After the deployment workflow is merged into `main` and completes successfully, the site should be available here:

```text
https://terratectra.github.io/tavernborne/
```

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

### Quaternius assets do not appear

Run:

```bash
npm run assets:install:quaternius
```

Then confirm this generated file exists:

```text
public/assets/quaternius/manifest.json
```

The build remains functional if an external asset host is temporarily unavailable, but the scene will use fallback procedural geometry for missing approved models.

### Deployment trigger

A push to `main` or a manual `Run workflow` starts the GitHub Pages deployment.
