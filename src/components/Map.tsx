"use client";
// @ts-ignore
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";
import { useEffect, useState } from "react";
const mapContainerStyle = {
  width: "100vw",
  height: "100vh",
};
const center = {
  lat: 36.763972,
  lng: -101.963318,
};

interface Satellite {
  satid: number;
  satlat: number;
  satlng: number;
}

async function fetchSatelliteData(userLocation: {
  lat: any;
  lng: any;
}): Promise<Satellite[]> {
  let [lat, lng] = [userLocation.lat, userLocation.lng];
  const response = await fetch(`/api/satellites?lat=${lat}&lng=${lng}`);
  console.log(response);
  if (!response.ok) {
    console.error("Server responded with status code", response.status);
    return [];
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    console.error("Error parsing JSON:", err);
    return [];
  }

  return data.satellites;
}

export const Map = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [userLocation, setUserLocation] = useState(center); // Set initial state to center

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  }, []);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      const newSatellites = await fetchSatelliteData(userLocation);
      setSatellites(newSatellites);
    }, 3000); // Fetch new data every 1 second

    return () => clearInterval(intervalId); // Clean up on unmount
  }, []); // Adjusted this line

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading maps</div>;

  return (
    <GoogleMap
      id="map"
      mapContainerStyle={mapContainerStyle}
      zoom={12}
      center={userLocation} // Use userLocation as center
    >
      <Marker position={userLocation} />
      {satellites &&
        satellites.map((satellite) => (
          <Marker
            key={`${satellite.satid}-${Date.now()}`} // Add a timestamp to the key
            position={{
              lat: satellite.satlat,
              lng: satellite.satlng,
            }}
            // label={satellite.satname}
            icon={{
              url: "/images/satellite.png", // replace with your image path
              scaledSize: new google.maps.Size(50, 50), // size
            }}
          />
        ))}
    </GoogleMap>
  );
};
