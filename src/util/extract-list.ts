/**
 * Evolution list endpoints vary by version/proxy:
 * - Item[]
 * - { messages|chats|contacts|groups|records: Item[] }
 * - { messages|…: { total, pages, records: Item[] } }
 */
export function extractList(data: unknown, keys: string[] = ["records"]): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const obj = data as Record<string, unknown>;

  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) {
      return val;
    }
    if (val && typeof val === "object") {
      const records = (val as { records?: unknown }).records;
      if (Array.isArray(records)) {
        return records;
      }
    }
  }

  // Fallback: nested records at top level
  if (Array.isArray(obj.records)) {
    return obj.records;
  }

  return [];
}
