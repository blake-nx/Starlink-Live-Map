# Starlink Live Map Manual QA

This checklist is the minimum bar before considering the experience shippable.

## Runbook

1. Start the app in WSL.

```bash
cd /mnt/c/Users/Blake/Documents/GitHub/Starlink-Live-Map
npm install
npm run dev
```

2. Open `http://localhost:3000` in a clean browser session.

3. Run the local API contract check.

```bash
python3 scripts/verify-starlink-api.py --base-url http://localhost:3000
```

## Must-Pass Checks

- The page must show a usable live map surface on first paint. No blue blank screen, no loading stall, and no full-page remount when data arrives.
- Panning and zooming must remain stable across live refreshes. The camera should not snap back, flash, or re-center unless the user explicitly geolocates.
- Clicking a satellite must open the selected satellite card and keep that object highlighted through subsequent polling cycles.
- Clicking empty map space must clear selection cleanly.
- Geolocation must only reveal the local Starlinks list when the user has granted location access, is zoomed into a local scale, and their location is inside the viewport.
- The local Starlinks list must disappear immediately when the user zooms back out or location is unavailable.
- The selected satellite card and the local Starlinks card must feel like one visual system, not two separate widgets.
- No console error should indicate map remounts, missing sources, or silent tile failures during normal use.
- The browser must remain responsive after several polling intervals, repeated selection changes, and a geolocate action.

## Failure Conditions

- Any camera reset caused by data refresh.
- Any blank or blue state that persists after the map has loaded.
- Any local satellite list visible while zoomed out.
- Any selected satellite that disappears from the scene without the detail card being updated.
- Any API response that fails the contract check above.
