export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const caller = options?.signal
  const cancel = () => controller.abort(caller?.reason)
  if (caller?.aborted) cancel()
  else caller?.addEventListener('abort', cancel, { once: true })
  let timedOut = false
  const id = setTimeout(() => { timedOut = true; controller.abort() }, 110_000)
  try {
    const response = await fetch(path, { ...options, signal: controller.signal })
    const data = await response.json().catch(error => {
      if (controller.signal.aborted) throw error
      return null
    })
    if (!response.ok) throw new Error(data?.error?.message ?? `Request failed (${response.status}). Please try again.`)
    if (!data) throw new Error('The server returned an unreadable response.')
    return data as T
  } catch (error) {
    if (caller?.aborted) throw caller.reason ?? error
    if (timedOut) throw new Error('The request timed out. Please try again.')
    if (error instanceof TypeError) throw new Error('Cannot reach the server. Check your connection and try again.')
    throw error
  } finally { clearTimeout(id); caller?.removeEventListener('abort', cancel) }
}
