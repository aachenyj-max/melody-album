import "server-only";

// Qwen may encode nullable arrays as JSON strings. Decode only these observed
// fields before Pi's unchanged schema validation and our semantic validation.
export function prepareQwenMemoryArguments(args: unknown): unknown {
  if (!args || typeof args !== "object" || Array.isArray(args)) return args;
  const prepared = { ...(args as Record<string, unknown>) };
  for (const field of ["people", "timeline"] as const) {
    const value = prepared[field];
    if (typeof value !== "string") continue;
    if (Buffer.byteLength(value) > 16 * 1024)
      throw new Error("工具数组参数超过解析上限。");
    let decoded: unknown;
    try {
      decoded = JSON.parse(value);
    } catch {
      throw new Error("工具数组参数必须是有效 JSON 数组或 null。");
    }
    if (decoded !== null && !Array.isArray(decoded))
      throw new Error("工具数组参数必须是 JSON 数组或 null。");
    prepared[field] = decoded;
  }
  return prepared;
}
