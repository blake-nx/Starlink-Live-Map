export function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDistanceKm(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${formatNumber(value, value < 100 ? 1 : 0)} km`;
}

export function formatCoordinate(value: number, positive: string, negative: string) {
  const absolute = Math.abs(value).toFixed(2);
  return `${absolute}° ${value >= 0 ? positive : negative}`;
}

export function formatRelativeTime(isoTimestamp: string) {
  const timestamp = new Date(isoTimestamp).getTime();

  if (Number.isNaN(timestamp)) {
    return "just now";
  }

  const deltaSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

  if (deltaSeconds < 5) {
    return "just now";
  }

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  return `${deltaHours}h ago`;
}

export function formatAbsoluteTime(isoTimestamp: string) {
  const timestamp = new Date(isoTimestamp);

  if (Number.isNaN(timestamp.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}
