# Starlink Atlas

A rebuilt Next.js app for a live, cinematic Starlink visualization experience.

## Stack

- Next.js 13
- React 18
- Tailwind CSS
- TypeScript
- Live Starlink telemetry from public TLE data

## Requirements

- Node.js 18 or newer
- npm 9 or newer

## Setup

```bash
npm install
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env.local
```

The app works without secrets by default. The `.env.local` file is only needed if you want to override the live TLE feed source.

## Run

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Build

Create a production build:

```bash
npm run build
```

Run the production server:

```bash
npm run start
```

## Lint

Run the project lint task:

```bash
npm run lint
```

## Environment

Copy `.env.example` to `.env.local` and adjust values as needed.

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

## Notes

- The current rebuild is designed to use public live Starlink data by default.
- Keep the page-level composition in `src/app/page.tsx`; the root layout is intentionally generic so the dashboard can evolve without touching global shell code.
