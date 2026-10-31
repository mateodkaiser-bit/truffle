// Free, keyless lookups for logging a new place from the map: food and drink places from
// OpenStreetMap (Overpass) and the address from PDOK Locatieserver.

export type NearbyPlace = {
  name: string;
  kind: string;
  lat: number;
  lon: number;
  address: string;
  dist: number;
};

export function distM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const x = (lon2 - lon1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  const y = (lat2 - lat1) * r;
  return Math.sqrt(x * x + y * y) * 6371000;
}

const AMENITIES = "restaurant|cafe|bar|pub|fast_food|ice_cream|biergarten|food_court";

export async function nearbyPlaces(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<NearbyPlace[]> {
  const q = `[out:json][timeout:10];(nwr(around:80,${lat},${lon})["amenity"~"^(${AMENITIES})$"]["name"];nwr(around:80,${lat},${lon})["shop"~"^(bakery|butcher|deli|coffee|cheese|seafood|wine)$"]["name"];);out center 20;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: q }),
    signal: signal ?? null,
  });
  if (!res.ok) throw new Error(`Place lookup failed (${res.status})`);
  const json = (await res.json()) as {
    elements: {
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }[];
  };
  return json.elements
    .flatMap((e) => {
      const plat = e.lat ?? e.center?.lat;
      const plon = e.lon ?? e.center?.lon;
      const t = e.tags ?? {};
      const name = t["name"];
      if (plat == null || plon == null || !name) return [];
      const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
      return [
        {
          name,
          kind: (t["amenity"] ?? t["shop"] ?? "").replace(/_/g, " "),
          lat: plat,
          lon: plon,
          address: street,
          dist: distM(lat, lon, plat, plon),
        },
      ];
    })
    .sort((a, b) => a.dist - b.dist);
}

export type Address = { address: string; postcode: string; city: string };

export async function reverseAddress(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<Address | null> {
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=${lat}&lon=${lon}&type=adres&rows=1&fl=straatnaam,huis_nlt,postcode,woonplaatsnaam`;
  const res = await fetch(url, { signal: signal ?? null });
  if (!res.ok) return null;
  const doc = (
    (await res.json()) as {
      response?: {
        docs?: Partial<Record<"straatnaam" | "huis_nlt" | "postcode" | "woonplaatsnaam", string>>[];
      };
    }
  ).response?.docs?.[0];
  if (!doc) return null;
  return {
    address: [doc.straatnaam, doc.huis_nlt].filter(Boolean).join(" "),
    postcode: doc.postcode ?? "",
    city: doc.woonplaatsnaam ?? "",
  };
}
