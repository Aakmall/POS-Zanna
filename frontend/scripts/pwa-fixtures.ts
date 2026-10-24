import { runInNewContext } from 'node:vm'
const ORIGIN = 'https://pos.test'
interface FetchRequest { url: string; method: string; mode: string }
interface WorkerEvent {
  waitUntil(promise: Promise<unknown>): void; respondWith?(promise: Promise<Response | undefined>): void
  request?: FetchRequest; data?: { type: string }; ports?: { postMessage(value: unknown): void }[]; source?: { id: string }
}
export function workerFixture(source: string, fetcher: (url: string) => Promise<Response> = async () => new Response('asset')) {
  const handlers = new Map<string, (event: WorkerEvent) => void>()
  class Cache {
    entries = new Map<string, Response>()
    async addAll(requests: Request[]) {
      const responses = await Promise.all(requests.map(async (r) => { const response = await fetcher(r.url); if (!response.ok) throw new Error('asset fetch failed'); return [new URL(r.url).pathname, response] as const }))
      for (const [path, response] of responses) this.entries.set(path, response)
    }
    async match(path: string) { return this.entries.get(path)?.clone() }
  }
  const caches = new Map<string, Cache>(), state = { clients: [{ id: 'current' }], skipWaiting: 0, claimed: 0 }
  runInNewContext(source, { URL, Set, Request: class extends Request { constructor(path: string, options?: RequestInit) { super(new URL(path, ORIGIN), options) } },
    fetch: (request: FetchRequest) => fetcher(request.url),
    caches: { async open(name: string) { if (!caches.has(name)) caches.set(name, new Cache()); return caches.get(name) }, async keys() { return [...caches.keys()] }, async delete(name: string) { return caches.delete(name) } },
    self: { location: { origin: ORIGIN }, addEventListener(name: string, handler: (event: WorkerEvent) => void) { handlers.set(name, handler) },
      clients: { async matchAll() { return state.clients }, async claim() { state.claimed++ } }, async skipWaiting() { state.skipWaiting++ } },
  })
  async function dispatch(name: string, extra: Partial<WorkerEvent> = {}) {
    const promises: Promise<unknown>[] = [], response: { value?: Promise<Response | undefined> } = {}
    handlers.get(name)!({ waitUntil(p) { promises.push(p) }, respondWith(p) { response.value = p }, ...extra })
    await Promise.all(promises); return response.value
  }
  return { state, caches, dispatch, async message(type: string) { let reply: unknown; await dispatch('message', { data: { type }, source: { id: 'current' }, ports: [{ postMessage(value) { reply = value } }] }); return reply },
    async request(path: string, mode = 'navigate', method = 'GET') { return dispatch('fetch', { request: { url: new URL(path, ORIGIN).href, method, mode } }) } }
}
