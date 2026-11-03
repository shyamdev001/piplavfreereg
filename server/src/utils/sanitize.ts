/**
 * Recursively strips keys that could be interpreted as MongoDB operators
 * (starting with "$") or that use dot-notation to reach into nested fields,
 * so user-supplied JSON can never inject query operators into a Mongoose
 * filter built from request input.
 */
export function sanitizeInput<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item)) as unknown as T;
  }
  if (input && typeof input === 'object' && !(input instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      result[key] = sanitizeInput(value);
    }
    return result as T;
  }
  return input;
}
