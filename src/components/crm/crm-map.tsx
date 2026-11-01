import { useEffect, useRef } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre looks for its worker next to its own module, which breaks once Vite bundles it.
// The build bundles the worker itself; the dev server injects its client into worker files,
// so dev loads the same version from jsDelivr instead.
import bundledWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { STAGE_META } from "@/lib/crm/stages";
import { STAGES, type Organization } from "@/lib/crm/types";

// Mapbox light when the Lovable Mapbox connector provides a token (as in Spotmapper); otherwise
// the PDOK BRT achtergrondkaart (Kadaster), free and keyless, in grey so the dots stand out.
const MAPBOX_TOKEN = import.meta.env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] as
  string | undefined;
const PDOK_TILES =
  "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png";

const stageColor = [
  "match",
  ["get", "stage"],
  ...STAGES.flatMap((s) => [s, STAGE_META[s].color]),
  "#888",
];

function toGeoJson(orgs: Organization[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: orgs
      .filter((o) => o.lat != null && o.lon != null)
      .map((o) => ({
        type: "Feature",
        id: o.id,
        geometry: { type: "Point", coordinates: [o.lon!, o.lat!] },
        properties: { id: o.id, stage: o.stage, name: o.name },
      })),
  };
}

/** The card covers the bottom of a phone screen and the right of a wide one: keep the dot in view. */
function cardOffset(m: MlMap): [number, number] {
  const c = m.getContainer();
  return c.clientWidth < 768 ? [0, -c.clientHeight * 0.33] : [-208, 0];
}

type MapLib = typeof import("maplibre-gl");
const view = {
  center: [4.75, 52.1] as [number, number],
  zoom: 7.3,
  attributionControl: false as const,
};

/** Mapbox GL with the token, else MapLibre on PDOK. Their APIs match for what this map uses. */
async function loadMap(): Promise<{ lib: MapLib; makeMap: (c: HTMLElement) => MlMap }> {
  if (MAPBOX_TOKEN) {
    const [{ default: mapboxgl }] = await Promise.all([
      import("mapbox-gl"),
      import("mapbox-gl/dist/mapbox-gl.css"),
    ]);
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const lib = mapboxgl as unknown as MapLib;
    return {
      lib,
      makeMap: (container) =>
        new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/light-v11",
          projection: "mercator",
          ...view,
        }) as unknown as MlMap,
    };
  }
  const maplibregl = await import("maplibre-gl");
  maplibregl.setWorkerUrl(
    import.meta.env.DEV
      ? `https://cdn.jsdelivr.net/npm/maplibre-gl@${maplibregl.getVersion()}/dist/maplibre-gl-worker.mjs`
      : bundledWorkerUrl,
  );
  return {
    lib: maplibregl,
    makeMap: (container) =>
      new maplibregl.Map({
        container,
        style: {
          version: 8,
          sources: {
            pdok: {
              type: "raster",
              tiles: [PDOK_TILES],
              tileSize: 256,
              maxzoom: 19,
              attribution: "Kaartgegevens &copy; Kadaster",
            },
          },
          layers: [{ id: "pdok", type: "raster", source: "pdok" }],
        },
        ...view,
      }),
  };
}

type Props = {
  orgs: Organization[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Tap away from any dot. `close` is true at street level, where a tap means "log a place here". */
  onTapEmpty: (lat: number, lon: number, close: boolean) => void;
  draft: { lat: number; lon: number } | null;
};

export function CrmMap({ orgs, selectedId, onSelect, onTapEmpty, draft }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const draftMarker = useRef<Marker | null>(null);
  const makeMarker = useRef<((lat: number, lon: number) => Marker) | null>(null);
  const ready = useRef(false);
  const latest = useRef({ orgs, selectedId, onSelect, onTapEmpty });
  latest.current = { orgs, selectedId, onSelect, onTapEmpty };

  useEffect(() => {
    let cancelled = false;
    void loadMap().then(({ lib, makeMap }) => {
      if (cancelled || !el.current) return;
      const m = makeMap(el.current);
      map.current = m;
      m.addControl(new lib.AttributionControl({ compact: true }));
      m.addControl(new lib.NavigationControl({ showCompass: false }), "bottom-right");
      const geo = new lib.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        fitBoundsOptions: { maxZoom: 16 },
      });
      m.addControl(geo, "bottom-right");
      makeMarker.current = (lat, lon) =>
        new lib.Marker({ color: "#1E1517" }).setLngLat([lon, lat]).addTo(m);
      m.on("load", () => {
        m.addSource("orgs", { type: "geojson", data: toGeoJson(latest.current.orgs) });
        m.addLayer({
          id: "orgs-selected",
          type: "circle",
          source: "orgs",
          filter: ["==", ["get", "id"], latest.current.selectedId ?? ""],
          paint: { "circle-radius": 13, "circle-color": "#1E1517", "circle-opacity": 0.25 },
        });
        m.addLayer({
          id: "orgs",
          type: "circle",
          source: "orgs",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3.5, 11, 6, 15, 9],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "circle-color": stageColor as any,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 1.5],
          },
        });
        // Like Spotmapper: open on the user's position when location is already allowed.
        void navigator.permissions
          ?.query({ name: "geolocation" })
          .then((p) => p.state === "granted" && geo.trigger())
          .catch(() => {});
        m.on("click", (e) => {
          // A finger is wide: look for a dot within 12 px of the tap.
          const box: [[number, number], [number, number]] = [
            [e.point.x - 12, e.point.y - 12],
            [e.point.x + 12, e.point.y + 12],
          ];
          const id = m.queryRenderedFeatures(box, { layers: ["orgs"] })[0]?.properties?.["id"];
          if (typeof id === "string") latest.current.onSelect(id);
          else latest.current.onTapEmpty(e.lngLat.lat, e.lngLat.lng, m.getZoom() >= 14);
        });
        m.on("mouseenter", "orgs", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "orgs", () => (m.getCanvas().style.cursor = ""));
        ready.current = true;
      });
    });
    return () => {
      cancelled = true;
      ready.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready.current || !map.current) return;
    (map.current.getSource("orgs") as GeoJSONSource | undefined)?.setData(toGeoJson(orgs));
  }, [orgs]);

  useEffect(() => {
    const m = map.current;
    if (!ready.current || !m) return;
    m.setFilter("orgs-selected", ["==", ["get", "id"], selectedId ?? ""]);
    const o = orgs.find((x) => x.id === selectedId);
    if (o?.lat != null && o.lon != null) {
      m.easeTo({ center: [o.lon, o.lat], zoom: Math.max(m.getZoom(), 14), offset: cardOffset(m) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    draftMarker.current?.remove();
    draftMarker.current = null;
    if (draft && makeMarker.current) {
      draftMarker.current = makeMarker.current(draft.lat, draft.lon);
      const m = map.current;
      if (m)
        m.easeTo({
          center: [draft.lon, draft.lat],
          zoom: Math.max(m.getZoom(), 16),
          offset: cardOffset(m),
        });
    }
  }, [draft]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
