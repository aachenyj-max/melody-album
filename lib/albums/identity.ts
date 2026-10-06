import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient as createUserClient } from "@/lib/supabase/server";

const cookieName = "memory_album_demo_scope";
const demoOwnerId = "a0b17c29-5ddb-4e5a-a979-32d54f8cb550";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AlbumIdentity = { ownerKey: string; kind: "auth" | "demo" };

function demoSecret(): string | null {
  const value = process.env.DEMO_SESSION_SECRET;
  return value && value.length >= 32 ? value : null;
}

function signature(scope: string, secret: string): string {
  return createHmac("sha256", secret).update(scope).digest("hex");
}

async function demoIdentity(create: boolean): Promise<AlbumIdentity | null> {
  const secret = demoSecret();
  if (!secret) return null;
  const jar = await cookies();
  const raw = jar.get(cookieName)?.value;
  if (raw) {
    const [scope, mac] = raw.split(".");
    if (scope && mac && uuid.test(scope) && /^[0-9a-f]{64}$/.test(mac)) {
      const expected = Buffer.from(signature(scope, secret), "hex");
      if (timingSafeEqual(expected, Buffer.from(mac, "hex")))
        return { ownerKey: `demo:${demoOwnerId}:${scope}`, kind: "demo" };
    }
  }
  if (!create) return null;
  const scope = crypto.randomUUID();
  jar.set(cookieName, `${scope}.${signature(scope, secret)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ownerKey: `demo:${demoOwnerId}:${scope}`, kind: "demo" };
}

export async function getAlbumIdentity(
  create = false,
): Promise<AlbumIdentity | null> {
  const client = await createUserClient();
  const { data } = await client.auth.getUser();
  if (data.user) return { ownerKey: `auth:${data.user.id}`, kind: "auth" };
  const existingDemo = await demoIdentity(false);
  if (existingDemo) return existingDemo;
  if (!create) return null;
  const signIn = await client.auth.signInAnonymously();
  if (signIn.data.user)
    return { ownerKey: `auth:${signIn.data.user.id}`, kind: "auth" };
  const code = signIn.error?.code ?? "";
  const disabled =
    [
      "anonymous_provider_disabled",
      "anonymous_signups_disabled",
      "signup_disabled",
    ].includes(code) ||
    /anonymous.*(disabled|not enabled)/i.test(signIn.error?.message ?? "");
  if (!disabled) throw new Error("SESSION_UNAVAILABLE");
  const fallback = await demoIdentity(true);
  if (!fallback) throw new Error("DEMO_SESSION_UNAVAILABLE");
  return fallback;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
