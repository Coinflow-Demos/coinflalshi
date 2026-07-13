export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://coinflalshi.vercel.app';

export async function apiFetch<T>(
  path: string,
  {token, method = 'GET', body}: {token?: string | null; method?: string; body?: unknown} = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `Request to ${path} failed (${response.status})`);
  }
  return data as T;
}
