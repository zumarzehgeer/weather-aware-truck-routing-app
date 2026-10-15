import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from '../src/api.ts'
import { duration } from '../src/types.ts'

function pending(signal: AbortSignal | null | undefined): Promise<never> {
  return new Promise((_, reject) => {
    if (signal?.aborted) reject(signal.reason)
    else signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

test('caller signal retains the request deadline and removes its listener', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const caller = new AbortController()
  const remove = t.mock.method(caller.signal, 'removeEventListener')
  t.mock.method(globalThis, 'fetch', (_path, options) => pending(options?.signal))
  const result = assert.rejects(api('/search', { signal: caller.signal }), /timed out/)
  t.mock.timers.tick(110_000)
  await result
  assert.equal(caller.signal.aborted, false)
  assert.equal(remove.mock.callCount(), 1)
})

test('caller cancellation preserves its reason and cleans up', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const caller = new AbortController()
  const remove = t.mock.method(caller.signal, 'removeEventListener')
  t.mock.method(globalThis, 'fetch', (_path, options) => pending(options?.signal))
  const reason = new DOMException('Search superseded', 'AbortError')
  const result = assert.rejects(api('/search', { signal: caller.signal }), error => error === reason)
  caller.abort(reason)
  await result
  assert.equal(remove.mock.callCount(), 1)
  t.mock.timers.tick(110_000)
})

test('an already cancelled request is not allowed to wait for its deadline', async t => {
  const caller = new AbortController()
  caller.abort()
  t.mock.method(globalThis, 'fetch', (_path, options) => pending(options?.signal))
  await assert.rejects(api('/search', { signal: caller.signal }), { name: 'AbortError' })
})

test('deadline still applies while reading the response body', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let reading!: () => void
  const started = new Promise<void>(resolve => { reading = resolve })
  t.mock.method(globalThis, 'fetch', async (_path, options) => ({
    ok: true, json: () => { reading(); return pending(options?.signal) },
  } as Response))
  const result = assert.rejects(api('/plan'), /timed out/)
  await started
  t.mock.timers.tick(110_000)
  await result
})

test('success clears deadline and detaches caller cancellation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const caller = new AbortController()
  let requestSignal: AbortSignal | null | undefined
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    requestSignal = options?.signal
    return Response.json({ results: [] })
  })
  assert.deepEqual(await api('/search', { signal: caller.signal }), { results: [] })
  caller.abort()
  t.mock.timers.tick(110_000)
  assert.equal(requestSignal?.aborted, false)
})

test('durations carry rounded minutes into hours', () => {
  assert.equal(duration(3599), '1h 0m')
  assert.equal(duration(7199), '2h 0m')
  assert.equal(duration(3539), '0h 59m')
})
