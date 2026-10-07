import "server-only";
import { createClient } from "@supabase/supabase-js";
import { Agent, fetch as nativeFetch, ProxyAgent } from "undici";
import { WorkbenchError } from "@/lib/workbench/contract";

const persistenceTransport = new Agent({ pipelining: 0 });
let proxyTransport: ProxyAgent | undefined;

export function createAdminClient(signal?: AbortSignal) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SECRET_KEY;
  if (!url || !secret || secret.startsWith("replace-"))
    throw new WorkbenchError(
      "DATA_UNAVAILABLE",
      "内部持久化尚未配置。",
      503,
      null,
      true,
    );
  return createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const proxyUrl = process.env.WORKBENCH_SUPABASE_PROXY_URL?.trim();
        if (proxyUrl) proxyTransport ??= new ProxyAgent(proxyUrl);
        // Avoid reusing idle sockets reset by the upstream gateway. Writes are never retried.
        const headers = new Headers(init?.headers);
        headers.set("Connection", "close");
        try {
          return (await nativeFetch(
            typeof input === "string" || input instanceof URL
              ? input
              : input.url,
            {
              ...init,
              headers,
              dispatcher: proxyUrl ? proxyTransport : persistenceTransport,
              signal: AbortSignal.any([
                AbortSignal.timeout(15000),
                ...(signal ? [signal] : []),
                ...(init?.signal ? [init.signal] : []),
              ]),
            } as Parameters<typeof nativeFetch>[1],
          )) as unknown as Response;
        } catch (error) {
          const cause =
            error instanceof Error &&
            error.cause &&
            typeof error.cause === "object" &&
            "code" in error.cause
              ? String(error.cause.code)
              : "unknown";
          console.error("Workbench persistence transport failed", {
            name: error instanceof Error ? error.name : "unknown",
            code: /^[A-Z_0-9]{1,64}$/.test(cause) ? cause : "unknown",
          });
          throw error;
        }
      },
    },
  });
}
