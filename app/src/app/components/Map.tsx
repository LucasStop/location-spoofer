"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapProps {
  onLocationSelect: (lat: number, lon: number) => void;
  selectedLocation: { lat: number; lon: number } | null;
  spoofedLocation: { lat: number; lon: number } | null;
}

export default function Map({
  onLocationSelect,
  selectedLocation,
  spoofedLocation,
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const spoofedMarkerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
    }).setView([-25.429, -49.271], 13);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OSM &amp; CARTO",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    // Forçar recálculo de tamanho após render
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update onLocationSelect callback ref
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.off("click");
    mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    });
  }, [onLocationSelect]);

  // Selected marker (red pin)
  useEffect(() => {
    if (!mapRef.current) return;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (selectedLocation) {
      mapRef.current.flyTo([selectedLocation.lat, selectedLocation.lon], 15, {
        duration: 1,
      });

      const icon = L.divIcon({
        html: `<div style="width:24px;height:24px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: "",
      });

      markerRef.current = L.marker([selectedLocation.lat, selectedLocation.lon], {
        icon,
      }).addTo(mapRef.current);
    }
  }, [selectedLocation]);

  // Spoofed location (blue pulsing dot)
  useEffect(() => {
    if (!mapRef.current) return;

    if (spoofedMarkerRef.current) {
      spoofedMarkerRef.current.remove();
      spoofedMarkerRef.current = null;
    }

    if (spoofedLocation) {
      spoofedMarkerRef.current = L.circleMarker(
        [spoofedLocation.lat, spoofedLocation.lon],
        {
          radius: 10,
          fillColor: "#3b82f6",
          fillOpacity: 0.8,
          color: "#fff",
          weight: 3,
        }
      ).addTo(mapRef.current);
    }
  }, [spoofedLocation]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100dvh",
        background: "#1a1a2e",
        zIndex: 0,
      }}
    />
  );
}
