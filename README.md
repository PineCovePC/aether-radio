# Aether

Live internet radio with liquid, audio-reactive visuals. Paste a Shoutcast or Icecast stream URL, or pick a station.

## Run locally

Needs Node 22+.

```bash
npm install
npm run dev
```

Then open the printed local URL. Streams are proxied through `/api/stream` so the visualizer can hear the audio (CORS).

## Play

- **Play** a listed station, or paste an `http(s)` MP3/AAC stream and **Tune**
- Cycle visuals: Drift, Kaleid, Spiral, Ripple, Pull
- Fullscreen on the vis (button or double-tap)

Private/local URLs are blocked by the proxy.

## Deploy

This is a TanStack Start app. Deploy to a Node host (Vercel is the intended target). GitHub Pages cannot host it — the stream proxy needs a server.
