// Proxy server-side para a chave do Google não ir ao browser.
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const q = p.get("q")?.trim();
  if (!q) return Response.json({ error: "missing q" }, { status: 400 });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return Response.json({ error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });

  const lat = parseFloat(p.get("lat") ?? "");
  const lon = parseFloat(p.get("lon") ?? "");
  const body: Record<string, unknown> = { textQuery: q, languageCode: "pt-BR", maxResultCount: 5 };
  if (!isNaN(lat) && !isNaN(lon)) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lon }, radius: 20000 } };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return Response.json({ error: data.error?.message ?? res.statusText }, { status: 502 });

  const results = (data.places ?? []).map(
    (pl: { displayName?: { text: string }; formattedAddress?: string; location: { latitude: number; longitude: number } }) => ({
      name: pl.displayName?.text ?? pl.formattedAddress ?? "",
      address: pl.formattedAddress ?? "",
      lat: pl.location.latitude,
      lon: pl.location.longitude,
    })
  );
  return Response.json({ results });
}
