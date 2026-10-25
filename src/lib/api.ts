export async function api<T = { ok: boolean; id?: string }>(
  path: string,
  options?: RequestInit,
  company?: string,
): Promise<T> {
  const url = new URL(`/api/${path}`, window.location.origin);
  if (company) url.searchParams.set("company", company);
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw Object.assign(
      new Error(
        String(
          data.error || data.message || "Unable to complete this request.",
        ),
      ),
      { status: response.status },
    );
  return data as T;
}
