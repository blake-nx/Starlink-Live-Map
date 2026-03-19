"use client";

import { useCallback, useEffect, useState } from "react";

export interface UserLocation {
  lat: number;
  lng: number;
}

export type UserLocationStatus =
  | "idle"
  | "locating"
  | "ready"
  | "denied"
  | "unsupported"
  | "error";

interface UseUserLocationResult {
  location: UserLocation | null;
  status: UserLocationStatus;
  errorMessage: string | null;
  refresh: () => void;
}

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<UserLocationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      setErrorMessage("Geolocation is not available in this browser.");
      return;
    }

    setStatus("locating");
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("ready");
      },
      (error) => {
        setLocation(null);

        if (error.code === error.PERMISSION_DENIED) {
          setStatus("denied");
          setErrorMessage("Location permission was denied.");
          return;
        }

        setStatus("error");
        setErrorMessage("Unable to determine your current location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      locate();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [locate]);

  return {
    location,
    status,
    errorMessage,
    refresh: locate,
  };
}
