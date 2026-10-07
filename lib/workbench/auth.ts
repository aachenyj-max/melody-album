import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { WorkbenchError } from "./contract";

export const SESSION_COOKIE = "agent_workbench_session";
const SESSION_SECONDS = 8 * 60 * 60;
const digest = (value: string) => createHash("sha256").update(value).digest();
export function equalSecret(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}
function settings() {
  const password = process.env.WORKBENCH_ACCESS_PASSWORD;
  const secret = process.env.WORKBENCH_SESSION_SECRET;
  const origin = process.env.WORKBENCH_PUBLIC_ORIGIN;
  if (!password || !secret || Buffer.byteLength(secret) < 32 || !origin)
    return null;
  try {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ))
    )
      return null;
    return { password, secret, origin, secure: url.protocol === "https:" };
  } catch {
    return null;
  }
}
export function workbenchEnabled() {
  return settings() !== null;
}
function requireSettings() {
  const config = settings();
  if (!config) throw new WorkbenchError("NOT_FOUND", "工作台未开放。", 404);
  return config;
}
function signature(payload: string) {
  const config = requireSettings();
  return createHmac("sha256", config.secret)
    .update(digest(config.password))
    .update(payload)
    .digest("base64url");
}
export function validSession(token: string | undefined) {
  if (!token || !settings() || token.length > 300) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, sig] = parts;
  const seconds = Number(expires);
  if (
    !/^\d{10}$/.test(expires) ||
    !/^[A-Za-z0-9_-]{32}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{43}$/.test(sig) ||
    seconds <= Math.floor(Date.now() / 1000) ||
    seconds > Math.floor(Date.now() / 1000) + SESSION_SECONDS
  )
    return false;
  return equalSecret(signature(`${expires}.${nonce}`), sig);
}
export async function isAuthenticated() {
  return validSession((await cookies()).get(SESSION_COOKIE)?.value);
}
export interface HumanAccess {
  readonly kind: "human";
}
export async function requireHuman(): Promise<HumanAccess> {
  requireSettings();
  if (!(await isAuthenticated()))
    throw new WorkbenchError("UNAUTHORIZED", "请先验证内部访问口令。", 401);
  return { kind: "human" };
}
export function requireOrigin(request: Request) {
  const config = requireSettings();
  if (request.headers.get("origin") !== config.origin)
    throw new WorkbenchError("FORBIDDEN", "请求来源不受信任。", 403);
}
export async function login(password: unknown) {
  const config = requireSettings();
  if (
    typeof password !== "string" ||
    password.length > 1024 ||
    !equalSecret(password, config.password)
  )
    throw new WorkbenchError("UNAUTHORIZED", "内部访问口令不正确。", 401);
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_SECONDS}.${randomBytes(24).toString("base64url")}`;
  (await cookies()).set(SESSION_COOKIE, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: config.secure,
    maxAge: SESSION_SECONDS,
  });
}
export async function logout() {
  const config = requireSettings();
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: config.secure,
    maxAge: 0,
  });
}
export function requireMachine(request: Request) {
  const expected = process.env.WORKBENCH_MAINTENANCE_TOKEN;
  if (!expected || Buffer.byteLength(expected) < 32)
    throw new WorkbenchError("NOT_FOUND", "维护接口未配置。", 404);
  const supplied = request.headers.get("authorization");
  if (
    !supplied ||
    supplied.length > 2048 ||
    !supplied.startsWith("Bearer ") ||
    !equalSecret(supplied.slice(7), expected)
  )
    throw new WorkbenchError("UNAUTHORIZED", "维护凭证无效。", 401);
}
