"use client";

import { useState } from "react";

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:3001";

interface ControlsProps {
  selectedLocation: { lat: number; lon: number } | null;
  spoofedLocation: { lat: number; lon: number } | null;
  onSpoof: (lat: number, lon: number) => void;
  onClear: () => void;
  onSearch: (lat: number, lon: number) => void;
}

interface HistoryEntry {
  lat: number;
  lon: number;
  name: string;
  time: string;
}

function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("spoof-history") || "[]");
  } catch {
    return [];
  }
}

function addToHistory(lat: number, lon: number, name?: string) {
  const history = getHistory();
  const entry: HistoryEntry = {
    lat,
    lon,
    name: name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
  const updated = [entry, ...history.filter((h) => h.lat !== lat || h.lon !== lon)].slice(0, 5);
  localStorage.setItem("spoof-history", JSON.stringify(updated));
}

export default function Controls({
  selectedLocation,
  spoofedLocation,
  onSpoof,
  onClear,
  onSearch,
}: ControlsProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function handleSpoof() {
    if (!selectedLocation) return;
    setLoading(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      const res = await fetch(`${BRIDGE_URL}/set-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: selectedLocation.lat, lon: selectedLocation.lon }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setLastResponse(`[${data.mode}] ${data.lat}, ${data.lon}`);
        onSpoof(selectedLocation.lat, selectedLocation.lon);
        addToHistory(selectedLocation.lat, selectedLocation.lon);
      } else {
        setStatus("error");
        setErrorMsg(data.error || data.stderr || "Erro desconhecido");
      }
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Sem conexão com o bridge server");
    } finally {
      setLoading(false);
      setTimeout(() => setStatus("idle"), 5000);
    }
  }

  async function handleClear() {
    setLoading(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      const res = await fetch(`${BRIDGE_URL}/clear-location`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        onClear();
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Erro ao limpar");
      }
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Sem conexão");
    } finally {
      setLoading(false);
      setTimeout(() => setStatus("idle"), 5000);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { "User-Agent": "LocationSpoofer/1.0" } }
      );
      const results = await res.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        onSearch(parseFloat(lat), parseFloat(lon));
        setSearchQuery("");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Erro ao buscar endereço");
    } finally {
      setSearching(false);
    }
  }

  const history = getHistory();

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-8 space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Buscar endereço..."
          className="flex-1 px-4 py-3 rounded-xl bg-zinc-900/90 backdrop-blur-md text-white placeholder-zinc-500 border border-zinc-700/50 text-sm focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-4 py-3 rounded-xl bg-zinc-800/90 backdrop-blur-md text-white border border-zinc-700/50 active:bg-zinc-700"
        >
          {searching ? "..." : "Ir"}
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-4 py-3 rounded-xl bg-zinc-800/90 backdrop-blur-md text-white border border-zinc-700/50 active:bg-zinc-700 text-sm"
        >
          {showHistory ? "X" : String.fromCodePoint(0x1f553)}
        </button>
      </div>

      {/* History dropdown */}
      {showHistory && history.length > 0 && (
        <div className="bg-zinc-900/95 backdrop-blur-md rounded-xl border border-zinc-700/50 overflow-hidden">
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => {
                onSearch(h.lat, h.lon);
                setShowHistory(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-zinc-300 border-b border-zinc-800 last:border-0 active:bg-zinc-800"
            >
              <span className="text-zinc-500 mr-2">{h.time}</span>
              {h.name.substring(0, 40)}
              {h.name.length > 40 ? "..." : ""}
            </button>
          ))}
        </div>
      )}

      {/* Coordinates display */}
      {selectedLocation && (
        <div className="text-center text-xs text-zinc-400 bg-zinc-900/70 backdrop-blur-md rounded-lg py-2">
          {selectedLocation.lat.toFixed(6)}, {selectedLocation.lon.toFixed(6)}
        </div>
      )}

      {/* Status message */}
      {status === "success" && (
        <div className="text-center text-sm text-green-400 bg-green-950/50 backdrop-blur-md rounded-lg py-2 px-3">
          Localização aplicada! {lastResponse}
        </div>
      )}
      {status === "error" && (
        <div className="text-center text-sm text-red-400 bg-red-950/50 backdrop-blur-md rounded-lg py-2">
          {errorMsg}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSpoof}
          disabled={!selectedLocation || loading}
          className="flex-1 py-4 rounded-2xl font-semibold text-white text-sm bg-blue-600 active:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors"
        >
          {loading ? "Enviando..." : "Definir Localização"}
        </button>
        {spoofedLocation && (
          <button
            onClick={handleClear}
            disabled={loading}
            className="px-6 py-4 rounded-2xl font-semibold text-white text-sm bg-zinc-700 active:bg-zinc-600 transition-colors"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
