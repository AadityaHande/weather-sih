// Shared lazy-loading handle for Leaflet.
//
// The map page and its components all need the same Leaflet instance. Importing
// Leaflet eagerly in a client component pulls it into the initial bundle; this
// module defers the load until the first caller and caches the promise so every
// consumer shares one copy. It also avoids `require("leaflet")` (which relied on
// webpack's `require` leaking into the client bundle — fragile under Turbopack).
//
// Usage:
//   const L = await getLeaflet();

type LeafletNamespace = typeof import("leaflet");

let leafletPromise: Promise<LeafletNamespace> | null = null;

export function getLeaflet(): Promise<LeafletNamespace> {
  if (!leafletPromise) {
    // `@types/leaflet` models the module as a UMD namespace with no `default`,
    // but the runtime ESM build exposes the `L` object as the default export.
    // Normalize both shapes here so callers can just `await getLeaflet()`.
    leafletPromise = import("leaflet").then(
      (mod) =>
        ((mod as unknown as { default?: LeafletNamespace }).default ??
          (mod as unknown as LeafletNamespace))
    );
  }
  return leafletPromise;
}
