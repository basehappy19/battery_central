"use client";

// Feature 11: Geolocation map using Leaflet (no API key required, unlike
// Google Maps). This file is only ever loaded via next/dynamic with
// ssr:false from DeviceCard, because Leaflet touches `window`/`document`
// at import time and breaks server-side rendering otherwise.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icon references image files via relative URLs
// that don't resolve correctly under a bundler. Rebuild it from the CDN so
// the pin actually renders instead of showing a broken image.
const defaultIcon = L.icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface DeviceMapProps {
  lat: number;
  lng: number;
  label?: string;
  heightClassName?: string;
}

export default function DeviceMap({ lat, lng, label, heightClassName = "h-48" }: DeviceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng], { icon: defaultIcon }).addTo(map);
    if (label) marker.bindPopup(label);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter without re-creating the map if coordinates change while mounted.
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([lat, lng]);
    }
  }, [lat, lng]);

  return <div ref={containerRef} className={`w-full ${heightClassName} rounded-xl overflow-hidden border border-slate-200`} />;
}
