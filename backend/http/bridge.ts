import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Preserve existing Web Request contracts while Nest owns HTTP routing/lifecycle. */
export async function bridge(req: ExpressRequest, res: ExpressResponse, handler: (request: Request) => Promise<Response>) {
  const cancellation = new AbortController();
  const close = () => { if (!res.writableFinished) cancellation.abort(); };
  res.once("close", close);
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    const request = new Request(`http://backend.internal${req.originalUrl}`, {
      method: req.method,
      headers,
      signal: cancellation.signal,
      ...(!["GET", "HEAD"].includes(req.method) ? { body: new Uint8Array(req.body || []) } : {}),
    });
    const response = await handler(request);
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key !== "set-cookie") res.setHeader(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    res.setHeader("X-Backend", "nestjs");
    res.setHeader("Cache-Control", "no-store");
    if (!response.body) { res.end(); return; }
    res.flushHeaders();
    await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), res);
  } catch (error) {
    if (cancellation.signal.aborted) return;
    // Let Nest sanitize exceptions before headers are committed.
    if (!res.headersSent) throw error;
    res.destroy();
  } finally {
    res.off("close", close);
  }
}
