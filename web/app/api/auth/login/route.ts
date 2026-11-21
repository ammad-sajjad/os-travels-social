import { NextResponse } from "next/server";
import { createSession, safeEqual, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  const { email = "", password = "" } = await request.json().catch(() => ({}));
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminEmail || !adminPassword) {
    return NextResponse.json({ error: "ADMIN_EMAIL and ADMIN_PASSWORD are not set on the website." }, { status: 500 });
  }
  const emailOk = await safeEqual(String(email).trim().toLowerCase(), adminEmail.trim().toLowerCase());
  const passOk = await safeEqual(String(password), adminPassword);
  if (!emailOk || !passOk) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(adminEmail), sessionCookieOptions);
  return res;
}
