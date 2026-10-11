# NEXORA

A tactical operations dashboard. Built as a single-page web app with no
framework — just vanilla JavaScript, Leaflet, and Three.js.

## What it does

- **Live world map** — Leaflet with a dark basemap, scanline overlay,
  vignette, and crosshair
- **Radar overlay** — rotating sweep with a 14-frame fading trail,
  range rings, and live coordinate readout
- **H-20 hologram** — Three.js flying-wing model with a custom GLSL
  fresnel shader, scan bar, and glow layers. Drag to orbit, scroll to zoom
- **Squad roster** — 6 operators with hand-drawn SVG insignia and status
  tracking
- **WiFi radar** — Python sidecar scans nearby networks with `nmcli` and
  serves them as JSON; the dashboard plots each network as a blip colored
  by signal strength

## Run locally

    python3 wifi-radar.py &      # WiFi sidecar on :8765
    python3 -m http.server 8000  # dashboard on :8000

Open http://localhost:8000

## Stack

- Leaflet 1.9 (map)
- Three.js 0.128 (3D)
- Custom GLSL (hologram shader)
- Python 3 http.server (WiFi sidecar)

## Notes

- The WiFi radar only works locally. Browsers can't access WiFi hardware,
  so the Python sidecar does the scanning and exposes it over localhost.
- Aircraft and satellite layers are placeholders — not wired to live APIs yet.
