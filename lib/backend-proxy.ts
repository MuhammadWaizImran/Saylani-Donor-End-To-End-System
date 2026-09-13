/** Same-origin BFF: cookies and streamed chat/download bodies pass through. */
export async function forwardToBackend(req: Request): Promise<Response> {
  const origin = process.env.NEST_BACKEND_URL || (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:4000" : "");
  if (!origin) return Response.json({ error: "Backend service is not configured." }, { status: 503 });
  const incoming = new URL(req.url);
  const target = new URL(origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  for (const name of ["cookie", "authorization", "content-type", "accept"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
      signal: req.signal,
      cache: "no-store",
      redirect: "manual",
    });
    const output = new Headers(response.headers);
    // fetch decompresses response bodies; don't forward stale wire lengths.
    for (const name of ["content-encoding", "content-length", "transfer-encoding", "connection"]) output.delete(name);
    output.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers: output });
  } catch {
    return Response.json({ error: "Backend service is temporarily unavailable." }, { status: 502 });
  }
}
