# Starlink Atlas

![Starlink Atlas demo](./demo.gif)

Starlink Atlas is a live Starlink visualization built on Next.js 16. It renders the constellation over an interactive world map, animates satellite motion between backend updates, and switches into a local sky workflow when geolocation is enabled and the map is zoomed into your area.

## What It Does

- Animates live Starlink ground positions using public TLE data from CelesTrak
- Keeps the map camera stable while satellite motion continues smoothly on the client
- Shows a local sky panel only when geolocation is on and you are zoomed into your area
- Lets you select a satellite to inspect its current stats and projected track
- Uses purpose-built API routes for global map data, observer-local data, and selected-satellite detail

## Stack

- Next.js 16.2
- React 19.2
- TypeScript 5.9
- MapLibre GL JS
- `satellite.js`
- Tailwind CSS

## Requirements

- Node.js 20 or newer
- npm compatible with Node 20+
- WSL shell if you want to follow the commands below exactly

## Setup

From WSL:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
nvm use 20 2>/dev/null || true
npm install
cp .env.example .env.local
```

The app works without secrets by default. `.env.local` is optional unless you want to override the upstream TLE feed source.

If your current shell is not already on Node 20+, you can still run the app with:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
npm install
cp .env.example .env.local
npx -y node@20 node_modules/next/dist/bin/next dev
```

## Run

Start the development server:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
nvm use 20 2>/dev/null || true
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If you need a clean dev restart:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
pkill -f "next dev" || true
rm -rf .next
nvm use 20 2>/dev/null || true
npm run dev
```

## Build And Start

Production build:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
nvm use 20 2>/dev/null || true
npm run build
```

Start the production server:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
nvm use 20 2>/dev/null || true
npm run start
```

## Verify

Lint:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
nvm use 20 2>/dev/null || true
npm run lint
```

Type-check:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
npx -y node@20 node_modules/typescript/bin/tsc --noEmit
```

Verify the Starlink API contract while the app is running:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
python3 scripts/verify-starlink-api.py --base-url http://localhost:3000
```

## Environment

Copy the example file if you want a local override:

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
cp .env.example .env.local
```

Current supported variable:

- `STARLINK_TLE_URL`
  Override the upstream Starlink TLE feed. By default the app uses the public CelesTrak Starlink feed.

## API Routes

- `/api/starlink/map`
  Returns the animated map dataset for the current viewport and zoom level.
- `/api/starlink/observer`
  Returns only observer-local sky data for the supplied latitude and longitude.
- `/api/starlink/satellite/[noradId]`
  Returns the selected satellite detail and projected track.

## Notes

- The frontend animates satellites between backend snapshots so motion stays smooth without refetching every frame.
- The local sky list is intentionally scoped to satellites actually above your horizon instead of every object in view.
- If the UI looks stale after an update, remove `.next`, restart the dev server, and hard-refresh the browser once.
