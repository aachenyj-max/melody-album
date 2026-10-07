import { login, logout, requireOrigin } from "@/lib/workbench/auth";
import { readJson } from "@/lib/workbench/contract";
import { endpoint, privateHeaders } from "@/lib/workbench/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    requireOrigin(request);
    const body = await readJson(request, ["password"]);
    await login(body.password);
    return new Response(null, { status: 204, headers: privateHeaders });
  });
}
export async function DELETE(request: Request) {
  return endpoint(async () => {
    requireOrigin(request);
    await logout();
    return new Response(null, { status: 204, headers: privateHeaders });
  });
}
