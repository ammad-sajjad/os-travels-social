// Forwards logged-in requests to the Railway backend, adding the shared secret.
// The browser never sees SERVER_API_KEY or any Meta/Claude keys.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

async function forward(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const jar = await cookies();
  if (!(await verifySession(jar.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }
  const serverUrl = process.env.SERVER_URL?.replace(/\/$/, "");
  if (!serverUrl) return NextResponse.json({ error: "SERVER_URL is not set on the website." }, { status: 500 });

  const { path } = await ctx.params;
  const target = `${serverUrl}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers: Record<string, string> = { "x-api-key": process.env.SERVER_API_KEY ?? "" };
  const type = request.headers.get("content-type");
  if (type) headers["content-type"] = type;
  const hasBody = !["GET", "HEAD"].includes(request.method);

  try {
    const res = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
    return new NextResponse(await res.arrayBuffer(), {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the backend server. Is it running?" }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
