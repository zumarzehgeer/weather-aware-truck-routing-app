export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const timeout = new AbortController()
  const id = setTimeout(() => timeout.abort(), 110_000)
  try {
    const response = await fetch(path, { ...options, signal: options?.signal ?? timeout.signal })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error?.message ?? `Request failed (${response.status}). Please try again.`)
    if (!data) throw new Error('The server returned an unreadable response.')
    return data as T
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The request timed out. Please try again.')
    if (error instanceof TypeError) throw new Error('Cannot reach the server. Check your connection and try again.')
    throw error
  } finally { clearTimeout(id) }
}
