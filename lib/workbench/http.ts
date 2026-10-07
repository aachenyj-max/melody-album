import "server-only";
import { errorData, WorkbenchError } from "./contract";

export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export function response(data: unknown, status = 200) {
  return Response.json(
    { contractVersion: 1, data },
    { status, headers: privateHeaders },
  );
}
export async function endpoint(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    return Response.json(
      {
        contractVersion: 1,
        error: errorData(error),
        ...(error instanceof WorkbenchError && error.runId
          ? { runId: error.runId }
          : {}),
      },
      {
        status: error instanceof WorkbenchError ? error.status : 503,
        headers: privateHeaders,
      },
    );
  }
}
export function queryFields(request: Request, allowed: string[]) {
  const query = new URL(request.url).searchParams;
  if (
    [...query.keys()].some(
      (key) => !allowed.includes(key) || query.getAll(key).length !== 1,
    )
  )
    throw new WorkbenchError("INVALID_INPUT", "查询字段无效。");
  return query;
}
