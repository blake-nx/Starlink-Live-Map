#!/usr/bin/env python3
"""Lightweight contract check for the Starlink API.

This script is intentionally dependency-free so it can run in WSL without
adding a test framework to the project. It validates the shape of the current
`/api/starlink` response for the global feed, an observer-local request, and a
selected satellite request.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True)
class CheckResult:
    name: str
    passed: bool
    detail: str = ""


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def is_string(value: Any) -> bool:
    return isinstance(value, str)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def get_json(url: str, timeout: int) -> tuple[int, dict[str, str], Any]:
    request = urllib.request.Request(url, headers={"accept": "application/json"})

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read().decode("utf-8")
            headers = {key.lower(): value for key, value in response.headers.items()}
            return response.status, headers, json.loads(payload)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        fail(f"HTTP {error.code} for {url}: {body[:400]}")
    except urllib.error.URLError as error:
        fail(f"Unable to reach {url}: {error.reason}")
    except json.JSONDecodeError as error:
        fail(f"Invalid JSON from {url}: {error}")


def validate_snapshot_shape(snapshot: dict[str, Any], *, require_user_context: bool) -> None:
    require(isinstance(snapshot, dict), "snapshot must be an object")
    require(is_string(snapshot.get("generatedAt")), "generatedAt must be a string")

    source = snapshot.get("source")
    require(isinstance(source, dict), "source must be an object")
    require(source.get("provider") == "CelesTrak", "source.provider must be CelesTrak")
    require(source.get("feed") == "Starlink", "source.feed must be Starlink")
    require(is_string(source.get("url")), "source.url must be a string")
    require(is_string(source.get("fetchedAt")), "source.fetchedAt must be a string")
    require(is_number(source.get("ageMs")), "source.ageMs must be numeric")
    require(source.get("ageMs") >= 0, "source.ageMs must be non-negative")
    require(isinstance(source.get("stale"), bool), "source.stale must be boolean")

    satellites = snapshot.get("satellites")
    require(isinstance(satellites, list), "satellites must be an array")
    require(len(satellites) > 0, "satellites should not be empty")

    first_satellite = satellites[0]
    require(isinstance(first_satellite, dict), "satellite items must be objects")
    require(isinstance(first_satellite.get("noradId"), int), "satellite.noradId must be an int")
    require(is_string(first_satellite.get("name")), "satellite.name must be a string")
    for key in ("latitude", "longitude", "altitudeKm", "speedKmPerSec"):
        require(is_number(first_satellite.get(key)), f"satellite.{key} must be numeric")

    metrics = snapshot.get("metrics")
    require(isinstance(metrics, dict), "metrics must be an object")
    require(isinstance(metrics.get("totalCount"), int), "metrics.totalCount must be an int")
    require(is_number(metrics.get("averageAltitudeKm")), "metrics.averageAltitudeKm must be numeric")
    require(is_number(metrics.get("averageSpeedKmPerSec")), "metrics.averageSpeedKmPerSec must be numeric")

    shell_breakdown = metrics.get("shellBreakdown")
    require(isinstance(shell_breakdown, dict), "metrics.shellBreakdown must be an object")
    hemisphere_breakdown = metrics.get("hemisphereBreakdown")
    require(isinstance(hemisphere_breakdown, dict), "metrics.hemisphereBreakdown must be an object")

    if require_user_context:
        user_context = snapshot.get("userContext")
        require(isinstance(user_context, dict), "userContext must be returned for observer-local requests")
        require(isinstance(user_context.get("visibleSatellites"), list), "userContext.visibleSatellites must be an array")
        require(isinstance(user_context.get("nearestSatellites"), list), "userContext.nearestSatellites must be an array")
        require(is_number(user_context.get("visibleCount")), "userContext.visibleCount must be numeric")
        nearest_range = user_context.get("nearestRangeKm")
        require(nearest_range is None or is_number(nearest_range), "userContext.nearestRangeKm must be numeric or null")


def validate_map_view_shape(view: dict[str, Any]) -> None:
    require(isinstance(view, dict), "map view must be an object")
    require(is_string(view.get("generatedAt")), "map.generatedAt must be a string")
    require(isinstance(view.get("source"), dict), "map.source must be an object")
    require(isinstance(view.get("view"), dict), "map.view must be an object")
    require(isinstance(view.get("animation"), dict), "map.animation must be an object")
    require(isinstance(view.get("satellites"), list), "map.satellites must be an array")
    require(isinstance(view.get("sampling"), dict), "map.sampling must be an object")
    require(len(view["satellites"]) > 0, "map.satellites should not be empty")

    mode = view["view"].get("mode")
    require(mode in {"overview", "regional", "local"}, "map.view.mode must be valid")
    require(
        is_number(view["animation"].get("leadSeconds")) and view["animation"]["leadSeconds"] > 0,
        "map.animation.leadSeconds must be a positive number",
    )

    sampling = view["sampling"]
    require(sampling.get("strategy") in {"global-bucket", "viewport-bucket", "full-viewport"}, "map.sampling.strategy must be valid")
    require(isinstance(sampling.get("returnedCount"), int), "map.sampling.returnedCount must be an int")
    if sampling.get("totalInViewport") is not None:
        require(isinstance(sampling.get("totalInViewport"), int), "map.sampling.totalInViewport must be an int or null")

    first_satellite = view["satellites"][0]
    require(isinstance(first_satellite, dict), "map satellite items must be objects")
    require(isinstance(first_satellite.get("noradId"), int), "map satellite.noradId must be an int")
    require(is_string(first_satellite.get("name")), "map satellite.name must be a string")
    for key in ("latitude", "longitude", "altitudeKm", "speedKmPerSec"):
        require(is_number(first_satellite.get(key)), f"map satellite.{key} must be numeric")
    for key in ("nextLatitude", "nextLongitude"):
        require(is_number(first_satellite.get(key)), f"map satellite.{key} must be numeric")


def validate_observer_view_shape(view: dict[str, Any]) -> None:
    require(isinstance(view, dict), "observer view must be an object")
    require(is_string(view.get("generatedAt")), "observer.generatedAt must be a string")
    require(isinstance(view.get("source"), dict), "observer.source must be an object")
    require(isinstance(view.get("observer"), dict), "observer.observer must be an object")
    require(isinstance(view.get("visibleNow"), list), "observer.visibleNow must be an array")
    require(isinstance(view.get("nearest"), list), "observer.nearest must be an array")
    require(isinstance(view.get("nextPasses"), list), "observer.nextPasses must be an array")
    require(isinstance(view.get("summary"), dict), "observer.summary must be an object")

    if view["visibleNow"]:
        require(view["visibleNow"][0].get("aboveHorizon") is True, "visibleNow items should represent satellites above the horizon")
    if view["nearest"]:
        require(is_number(view["nearest"][0].get("rangeKm")) or view["nearest"][0].get("rangeKm") is None, "nearest items should include range data")


def validate_detail_shape(view: dict[str, Any]) -> None:
    require(isinstance(view, dict), "detail view must be an object")
    require(is_string(view.get("generatedAt")), "detail.generatedAt must be a string")
    require(isinstance(view.get("source"), dict), "detail.source must be an object")
    require(isinstance(view.get("satellite"), dict), "detail.satellite must be an object")
    require(isinstance(view.get("track"), list), "detail.track must be an array")
    require(len(view["track"]) > 0, "detail.track should not be empty")


def run(base_url: str, timeout: int) -> list[CheckResult]:
    base_url = base_url.rstrip("/")
    checks: list[CheckResult] = []

    global_url = f"{base_url}/api/starlink?limit=5"
    status, headers, payload = get_json(global_url, timeout)
    require(status == 200, f"global request returned HTTP {status}")
    require(headers.get("cache-control") == "no-store, max-age=0", "global request should disable response caching")
    validate_snapshot_shape(payload, require_user_context=False)
    checks.append(CheckResult("global snapshot", True, "shape and headers validated"))

    first_satellite = payload["satellites"][0]
    norad_id = first_satellite["noradId"]

    map_url = f"{base_url}/api/starlink/map?limit=5&mode=overview"
    status, headers, payload = get_json(map_url, timeout)
    require(status == 200, f"map request returned HTTP {status}")
    require(headers.get("cache-control") == "no-store, max-age=0", "map request should disable response caching")
    validate_map_view_shape(payload)
    checks.append(CheckResult("map view", True, "sampling and satellite shape validated"))

    observer_url = f"{base_url}/api/starlink/observer?lat=37.7749&lng=-122.4194"
    status, headers, payload = get_json(observer_url, timeout)
    require(status == 200, f"observer request returned HTTP {status}")
    require(headers.get("cache-control") == "no-store, max-age=0", "observer request should disable response caching")
    validate_observer_view_shape(payload)
    checks.append(CheckResult("observer snapshot", True, "local context shape validated"))

    selected_url = f"{base_url}/api/starlink/satellite/{norad_id}?lat=37.7749&lng=-122.4194"
    status, headers, payload = get_json(selected_url, timeout)
    require(status == 200, f"selected request returned HTTP {status}")
    require(headers.get("cache-control") == "no-store, max-age=0", "selected request should disable response caching")
    validate_detail_shape(payload)
    require(payload["satellite"].get("noradId") == norad_id, "selected satellite response should match the requested NORAD id")
    require(isinstance(payload.get("observerRelation"), dict), "selected satellite response should include observerRelation")
    checks.append(CheckResult("selected satellite", True, f"noradId {norad_id} present in response"))

    return checks


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate the Starlink API contract.")
    parser.add_argument("--base-url", default="http://localhost:3000", help="Base URL for the app server")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds")
    args = parser.parse_args()

    try:
        checks = run(args.base_url, args.timeout)
    except SystemExit:
        raise
    except Exception as error:  # pragma: no cover - defensive top-level guard
        fail(str(error))

    print("Starlink API contract checks passed")
    for check in checks:
        print(f"- {check.name}: {check.detail}")


if __name__ == "__main__":
    main()
