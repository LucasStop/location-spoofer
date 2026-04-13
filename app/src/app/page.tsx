"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Controls from "./components/Controls";

const Map = dynamic(() => import("./components/Map"), { ssr: false });

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [spoofedLocation, setSpoofedLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const handleLocationSelect = useCallback((lat: number, lon: number) => {
    setSelectedLocation({ lat, lon });
  }, []);

  const handleSpoof = useCallback((lat: number, lon: number) => {
    setSpoofedLocation({ lat, lon });
  }, []);

  const handleClear = useCallback(() => {
    setSpoofedLocation(null);
  }, []);

  const handleSearch = useCallback((lat: number, lon: number) => {
    setSelectedLocation({ lat, lon });
  }, []);

  return (
    <main className="relative h-full w-full">
      <Map
        onLocationSelect={handleLocationSelect}
        selectedLocation={selectedLocation}
        spoofedLocation={spoofedLocation}
      />
      <Controls
        selectedLocation={selectedLocation}
        spoofedLocation={spoofedLocation}
        onSpoof={handleSpoof}
        onClear={handleClear}
        onSearch={handleSearch}
      />
    </main>
  );
}
