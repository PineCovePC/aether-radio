import { createFileRoute } from "@tanstack/react-router";
import { parsePublicHttpUrl } from "@/lib/safe-url";

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

async function proxy(request: Request) {
  const incoming = new URL(request.url);
  const raw = incoming.searchParams.get("url") ?? "";
  const target = parsePublicHttpUrl(raw);
  if (!target) {
    return Response.json({ error: "Invalid stream URL" }, { status: 400 });
  }

  const headers = new Headers();
  headers.set("User-Agent", "AetherRadio/1.0 (compatible; Icecast)");
  headers.set("Icy-MetaData", "0");
  headers.set("Accept", "*/*");
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers,
      redirect: "follow",
      signal: request.signal,
    });
  } catch {
    return Response.json({ error: "Stream unreachable" }, { status: 502 });
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "set-cookie") return;
    out.set(key, value);
  });
  if (!out.has("content-type")) {
    out.set("content-type", "audio/mpeg");
  }
  out.set("cache-control", "no-store");
  out.set("access-control-allow-origin", "*");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: ({ request }) => proxy(request),
      HEAD: ({ request }) => proxy(request),
    },
  },
});
