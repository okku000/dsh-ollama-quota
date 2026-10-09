#!/usr/bin/env node
/**
 * Verification for dsh-ollama-quota.
 *
 * Offline (default): no network and no browser.
 *  - Host: `apply` is driven with a recording fake context; the snapshot route
 *    is invoked for the healthy, missing-key, unauthorized, rate-limited,
 *    unsupported-shape, and network paths, plus a healthy balance with a failed
 *    usage report.
 *  - Client: `client.js` is evaluated with a minimal React/hook runtime, its
 *    factory is applied to a recording slot registry, and the section component
 *    is rendered for the loaded, no-key, and fetch-failure states.
 *
 * Live (`--live`): the same Host half is mounted with the credential reference
 * read from `$DSH_HOME/.credentials.yaml` and the real `fetch`, so the
 * projections are asserted against the endpoints Ollama answers right now.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = process.argv.includes('--live')
const failures = []
const passes = []

function check(condition, message) {
  if (condition) passes.push(message)
  else failures.push(message)
}

const BALANCE_PATH = 'https://ollama.com/api/balance'
const USAGE_PREFIX = 'https://ollama.com/api/usage?range='

/** One live-shaped balance body. */
const BALANCE_SAMPLE = {
  included: {
    balance_usd: 59.94249,
    allowance_usd: 60,
    period: { from: '2026-10-05T04:52:03Z', until: '2026-11-05T04:52:03Z' },
  },
  purchased: { balance_usd: 0 },
}

/** One live-shaped usage body. */
const USAGE_SAMPLE = {
  range: '30d',
  scope: 'self',
  granularity: 'day',
  from: '2026-09-09T00:00:00Z',
  until: '2026-10-09T08:20:20.53443312Z',
  totals: {
    request_count: 137,
    usage_usd: 1.2345,
    input_tokens: 456789,
    cached_input_tokens: 12345,
    output_tokens: 6789,
  },
  buckets: [
    { from: '2026-10-07T00:00:00Z', until: '2026-10-08T00:00:00Z', request_count: 12, usage_usd: 0.5 },
    { from: '2026-10-08T00:00:00Z', until: '2026-10-09T00:00:00Z', request_count: 30, usage_usd: 1.9 },
  ],
}

// ---------------------------------------------------------------- host half

/**
 * Drive the Host half with a recording context.
 * @param options - resolved credential map.
 * @returns the recording context plus the registered routes.
 */
function hostHarness(options = {}) {
  const routes = []
  const listeners = new Map()
  const context = {
    credentials: {
      async resolve(ref) {
        const value = (options.credentials || {})[ref]
        return value === undefined ? undefined : { value, source: 'test' }
      },
    },
    interval(callback, ms) {
      context.timer = { callback, ms }
      return () => undefined
    },
    get(name) {
      if (name !== 'webServer') return undefined
      return { register(route) { routes.push(route); return () => undefined } }
    },
    effect(callback) { callback() },
    on(event, listener) { listeners.set(event, listener); return () => undefined },
  }
  return { context, routes, listeners }
}

/** Invoke one registered route and read its JSON body. */
async function readRoute(route, url) {
  const chunks = []
  const response = {
    writeHead(status, headers) { response.status = status; response.headers = headers },
    end(body) { chunks.push(body) },
  }
  await route.handler({ url }, response)
  return { status: response.status, body: JSON.parse(chunks.join('')) }
}

/** Let the poller's promise chain settle. */
async function settle(turns = 8) {
  for (let index = 0; index < turns; index++) await new Promise((resolve) => setTimeout(resolve, 0))
}

/** A fetch stub answering both endpoints from one table. */
function stubFetch(table) {
  return async (url, init) => {
    const request = { url: String(url), authorization: init && init.headers ? init.headers.Authorization : undefined }
    const answer = table(request)
    return answer
  }
}

/** The healthy two-endpoint table. */
function healthyTable(request) {
  if (request.url === BALANCE_PATH) return { ok: true, status: 200, async json() { return BALANCE_SAMPLE } }
  if (request.url.indexOf(USAGE_PREFIX) === 0) return { ok: true, status: 200, async json() { return USAGE_SAMPLE } }
  throw new Error('unexpected url: ' + request.url)
}

const hostModule = await import(new URL('../index.js', import.meta.url).href)
check(hostModule.name === 'ollama-quota', 'host half exports name')
check(Array.isArray(hostModule.inject) && hostModule.inject.includes('credentials'), 'host half injects credentials')
check(Array.isArray(hostModule.inject) && hostModule.inject.includes('timer'), 'host half injects timer')
check(typeof hostModule.apply === 'function', 'host half exports apply')

/**
 * Run one Host scenario to a settled snapshot.
 * @param credentials - credential reference map.
 * @param fetchImpl - fetch replacement.
 * @param config - plugin row config.
 * @param force - read the route with `?force=1`, which awaits a network refresh.
 * @returns the snapshot body plus the harness.
 */
async function hostSnapshot(credentials, fetchImpl, config = {}, force = false) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    const { context, routes, listeners } = hostHarness({ credentials })
    hostModule.apply(context, config)
    check(routes.length === 1, 'host registers one snapshot route')
    check(routes[0].path === '/ollama-quota/snapshot', 'route path is the documented snapshot path')
    await settle()
    const snapshot = await readRoute(routes[0], '/ollama-quota/snapshot' + (force ? '?force=1' : ''))
    return { status: snapshot.status, body: snapshot.body, routes, listeners, context }
  } finally {
    globalThis.fetch = originalFetch
  }
}

const seen = []
const healthy = await hostSnapshot({ OLLAMA_CLOUD_API_KEY: 'test-key' }, stubFetch((request) => {
  seen.push(request)
  return healthyTable(request)
}))
check(healthy.status === 200, 'snapshot route answers 200')
check(healthy.body.error === null, 'healthy snapshot has no error')
check(seen.length === 2, 'host reads both the balance and the usage endpoint')
check(seen.some((request) => request.url === BALANCE_PATH), 'host reads the documented balance URL')
check(seen.some((request) => request.url === USAGE_PREFIX + '30d'), 'host reads the documented usage URL for the default range')
check(seen.every((request) => request.authorization === 'Bearer test-key'), 'host sends the resolved key as a bearer token')
check(healthy.body.balance.includedUsd === 59.94249, 'included balance is projected')
check(healthy.body.balance.allowanceUsd === 60, 'allowance is projected')
check(Math.abs(healthy.body.balance.usedUsd - 0.05751) < 1e-9, 'used credit is allowance - balance')
check(healthy.body.balance.purchasedUsd === 0, 'purchased credit is projected')
check(healthy.body.balance.period.startingAt === '2026-10-05T04:52:03Z', 'allowance period start is projected')
check(healthy.body.balance.period.endingAt === '2026-11-05T04:52:03Z', 'allowance period end is projected')
check(healthy.body.usage.spentUsd === 1.2345, 'usage cost total is projected')
check(healthy.body.usage.requests === 137, 'usage request total is projected')
check(healthy.body.usage.inputTokens === 456789, 'usage input token total is projected')
check(healthy.body.usage.cachedInputTokens === 12345, 'usage cached token total is projected')
check(healthy.body.usage.outputTokens === 6789, 'usage output token total is projected')
check(healthy.body.usage.daily.length === 2, 'daily buckets are projected')
check(healthy.body.usage.daily[1].usd === 1.9, 'daily bucket cost is projected')
check(healthy.body.usageError === null, 'healthy usage reports no error')
check(healthy.body.keyEnv === 'OLLAMA_CLOUD_API_KEY', 'snapshot reports which reference resolved')
check(!JSON.stringify(healthy.body).includes('test-key'), 'snapshot never carries the key')
check(
  Array.isArray(healthy.body.keyEnvs) && healthy.body.keyEnvs.join(',') === 'OLLAMA_CLOUD_API_KEY,OLLAMA_API_KEY',
  'snapshot publishes the credential reference order',
)
check(healthy.body.usageRange === '30d', 'snapshot publishes the configured usage range')

// The retired `limits` shape must be reported as an unsupported answer, not as a credit.
const noCredit = await hostSnapshot({ OLLAMA_CLOUD_API_KEY: 'x' }, stubFetch((request) => {
  if (request.url === BALANCE_PATH) return { ok: true, status: 200, async json() { return { activity: {}, limits: {} } } }
  return healthyTable(request)
}))
check(noCredit.body.error === 'bad-json', 'a response without a credit block maps to the bad-json label')
check(noCredit.body.detail === 'response carried no included credit block', 'the unsupported shape names what was missing')
check(noCredit.body.balance === null, 'an unsupported balance response yields no balance')

// A failing usage report must not hide a healthy balance.
const usageDown = await hostSnapshot({ OLLAMA_CLOUD_API_KEY: 'x' }, stubFetch((request) => {
  if (request.url === BALANCE_PATH) return healthyTable(request)
  throw new Error('socket hang up')
}))
check(usageDown.body.error === null, 'a failed usage report leaves the snapshot healthy')
check(usageDown.body.balance.includedUsd === 59.94249, 'a failed usage report keeps the balance')
check(usageDown.body.usageError === 'network', 'the failed usage report carries its own label')

// A key written through the settings UI must reach a new snapshot immediately.
let refreshFetches = 0
const counting = stubFetch((request) => { refreshFetches += 1; return healthyTable(request) })
const refreshed = await hostSnapshot({ OLLAMA_CLOUD_API_KEY: 'test-key' }, counting)
const beforeRefreshFetches = refreshFetches
const originalFetchForRefresh = globalThis.fetch
globalThis.fetch = counting
refreshed.listeners.get('credentials/updated')()
await settle()
globalThis.fetch = originalFetchForRefresh
check(refreshFetches > beforeRefreshFetches, 'credentials/updated triggers an immediate refresh')

const fallback = await hostSnapshot({ OLLAMA_API_KEY: 'fallback-key' }, stubFetch(healthyTable))
check(fallback.body.keyEnv === 'OLLAMA_API_KEY', 'second reference is used when the first is absent')

const custom = await hostSnapshot(
  { OLLAMA_CLOUD_API_KEY: 'x' },
  stubFetch((request) => {
    check(request.url.indexOf('https://proxy.example') === 0, 'apiBase config redirects both requests')
    return healthyTable(request)
  }),
  { apiBase: 'https://proxy.example/', usageRange: '7d' },
)
check(custom.body.usageRange === '7d', 'usageRange config reaches the snapshot')

// The usage report has its own slower cadence; a balance tick reuses it.
let usageCalls = 0
let balanceCalls = 0
const cadenceFetch = stubFetch((request) => {
  if (request.url.indexOf(USAGE_PREFIX) === 0) usageCalls += 1
  else balanceCalls += 1
  return healthyTable(request)
})
const originalFetchForCadence = globalThis.fetch
globalThis.fetch = cadenceFetch
try {
  const cadence = hostHarness({ credentials: { OLLAMA_CLOUD_API_KEY: 'x' } })
  hostModule.apply(cadence.context, {})
  await settle()
  await readRoute(cadence.routes[0], '/ollama-quota/snapshot')
  check(usageCalls === 1 && balanceCalls === 1, 'the first snapshot reads each endpoint once')
  cadence.context.timer.callback()
  await settle()
  check(usageCalls === 1, 'a periodic balance tick reuses the usage reading')
  check(balanceCalls === 2, 'a periodic balance tick still re-reads the balance')
  await readRoute(cadence.routes[0], '/ollama-quota/snapshot?force=1')
  check(usageCalls === 2, 'a forced refresh re-reads the usage report')
  check(balanceCalls === 3, 'a forced refresh re-reads the balance')
} finally {
  globalThis.fetch = originalFetchForCadence
}

const missing = await hostSnapshot({}, async () => {
  throw new Error('fetch must not run without a key')
})
check(missing.body.error === 'no-key', 'missing credential yields the no-key label')

const unauthorized = await hostSnapshot(
  { OLLAMA_CLOUD_API_KEY: 'bad' },
  stubFetch(() => ({ ok: false, status: 401, async json() { return {} } })),
)
check(unauthorized.body.error === 'unauthorized', '401 maps to the unauthorized label')

const throttled = await hostSnapshot(
  { OLLAMA_CLOUD_API_KEY: 'x' },
  stubFetch(() => ({ ok: false, status: 429, async json() { return {} } })),
)
check(throttled.body.error === 'rate-limited', '429 maps to the rate-limited label')

const broken = await hostSnapshot(
  { OLLAMA_CLOUD_API_KEY: 'x' },
  async () => { throw new Error('socket hang up') },
)
check(broken.body.error === 'network', 'transport failure maps to the network label')

const notJson = await hostSnapshot(
  { OLLAMA_CLOUD_API_KEY: 'x' },
  stubFetch(() => ({ ok: true, status: 200, async json() { throw new Error('not json') } })),
)
check(notJson.body.error === 'bad-json', 'a non-JSON body maps to the bad-json label')

// -------------------------------------------------------------- client half

/** Minimal React runtime: createElement plus the three hooks the section uses. */
function createReact() {
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const state = { hooks: [], cursor: 0, pending: [], dirty: false }
  const React = {
    createElement(type, props, ...children) {
      const kids = []
      for (const child of children) {
        if (Array.isArray(child)) kids.push(...child)
        else if (child !== null && child !== undefined && child !== false) kids.push(child)
      }
      return { type, props: Object.assign({}, props || {}, kids.length > 0 ? { children: kids } : {}) }
    },
    useState(initial) {
      const index = state.cursor++
      if (!(index in state.hooks)) state.hooks[index] = { value: typeof initial === 'function' ? initial() : initial }
      const slot = state.hooks[index]
      return [slot.value, (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; state.dirty = true }]
    },
    useCallback(fn, deps) {
      const index = state.cursor++
      const slot = state.hooks[index]
      if (slot && same(slot.deps, deps)) return slot.fn
      state.hooks[index] = { fn, deps }
      return fn
    },
    useEffect(fn, deps) {
      const index = state.cursor++
      const slot = state.hooks[index]
      if (slot && same(slot.deps, deps)) return
      state.hooks[index] = { deps }
      state.pending.push(fn)
    },
  }
  return { React, state }
}

/** Collect all text out of a rendered element tree. */
function collectText(node, out) {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out }
  if (Array.isArray(node)) { for (const child of node) collectText(child, out); return out }
  if (typeof node.type === 'function') { collectText(node.type(node.props), out); return out }
  return collectText(node.props.children, out)
}

/** Load client.js, returning its captured definition. */
function loadClientDefinition(language) {
  let definition
  const window = { __ModuleLoader__: { load(value) { definition = value } } }
  const document = {
    querySelector() { return {} },
    createElement() { return { dataset: {}, style: {}, textContent: '' } },
    head: { appendChild() {} },
  }
  const code = readFileSync(join(ROOT, 'client.js'), 'utf8')
  const factory = new Function('window', 'document', 'navigator', 'setInterval', 'clearInterval', code)
  factory(window, document, { language }, () => 0, () => undefined)
  return definition
}

const definition = loadClientDefinition('ja-JP')
check(definition !== undefined, 'client bundle loads through __ModuleLoader__')
check(definition.id === 'dsh-ollama-quota', 'client bundle id matches the package name')

const { React, state } = createReact()
const clientExports = definition.factory((name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
})
check(typeof clientExports.apply === 'function', 'client half exports apply')
check(Array.isArray(clientExports.inject) && clientExports.inject.includes('slots'), 'client half injects slots')

let registration
const slots = {
  inject(name, callback) { callback() },
  register(options, Component) { registration = { options, Component }; return () => undefined },
}
clientExports.apply({ get: (name) => (name === 'slots' ? slots : undefined) })
check(registration !== undefined, 'client registers one slot contribution')
check(registration.options.name === 'settings.section', 'contribution targets settings.section')
check(registration.options.id === 'ollama-quota', 'contribution uses its own section id')
check(registration.options.order === -9, 'section sits directly below the account entry (-10)')
check(registration.options.label() === 'Ollama 残高', 'browser-language fallback projects the Japanese nav label')

/** Collect host elements matching a predicate, expanding function components. */
function findElements(node, match, out = []) {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') return out
  if (Array.isArray(node)) { for (const child of node) findElements(child, match, out); return out }
  if (typeof node.type === 'function') { findElements(node.type(node.props), match, out); return out }
  if (typeof node.type === 'string' && match(node)) out.push(node)
  findElements(node.props.children, match, out)
  return out
}

/** Whether one element carries a CSS class token. */
function hasClass(node, token) {
  return typeof node.props.className === 'string' && node.props.className.split(' ').includes(token)
}

/**
 * Render one component to a settled tree.
 * @param Component - component function.
 * @param fetchImpl - global fetch replacement.
 * @param reset - start from fresh hook state.
 * @returns the final element tree and its collected text.
 */
async function renderComponent(Component, fetchImpl, reset = false) {
  if (reset) { state.hooks = []; state.dirty = false }
  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    let tree = null
    let text = ''
    for (let tick = 0; tick < 60; tick++) {
      state.cursor = 0
      state.pending = []
      tree = Component()
      for (const effect of state.pending) effect()
      text = collectText(tree, []).join(' ')
      for (let flush = 0; flush < 6; flush++) await Promise.resolve()
      if (!state.dirty) break
      state.dirty = false
    }
    return { tree, text }
  } finally {
    globalThis.fetch = originalFetch
  }
}

/** Snapshot fetch stub carrying the healthy body plus the reference order. */
async function loadedSnapshot(url) {
  if (url === '/ollama-quota/snapshot' || url.indexOf('/ollama-quota/snapshot?') === 0) {
    return { ok: true, json: async () => Object.assign({ updatedAt: Date.now(), keyEnv: 'OLLAMA_CLOUD_API_KEY' }, healthy.body) }
  }
  throw new Error('unexpected url: ' + url)
}

const loaded = (await renderComponent(registration.Component, loadedSnapshot, true)).text
check(loaded.includes('$59.94'), 'loaded view shows the remaining credit')
check(loaded.includes('$60.00'), 'loaded view shows the allowance')
check(loaded.includes('$0.06'), 'loaded view shows the used credit')
check(loaded.includes('2026'), 'loaded view shows the allowance period')
check(loaded.includes('$1.23'), 'loaded view shows the usage cost total')
check(loaded.includes('137'), 'loaded view shows the request count')
check(loaded.includes('456,789'), 'loaded view shows the input token count')
check(loaded.includes('OLLAMA_CLOUD_API_KEY'), 'loaded view names the key source')
check(loaded.includes('API キー'), 'loaded view renders the key editor title')
check(loaded.includes('このクライアントからは資格情報を書き込めません'), 'without a remote service the editor explains manual configuration')

const spark = findElements((await renderComponent(registration.Component, loadedSnapshot, true)).tree, (node) => hasClass(node, 'oq-spark'))
check(spark.length === 1, 'loaded view renders the daily spend strip')

const noKey = (await renderComponent(registration.Component, async () => ({
  ok: true,
  json: async () => ({
    updatedAt: Date.now(), error: 'no-key', detail: null, keyEnv: null, balance: null, usage: null,
    usageError: null, usageDetail: null, keyEnvs: ['OLLAMA_CLOUD_API_KEY', 'OLLAMA_API_KEY'], usageRange: '30d',
  }),
}), true)).text
check(noKey.includes('OLLAMA_CLOUD_API_KEY'), 'no-key view names the reference to configure')

const failed = (await renderComponent(registration.Component, async () => { throw new Error('offline') }, true)).text
check(failed.includes('プラグインのスナップショットを読み取れません'), 'fetch failure keeps the page and offers retry copy')

const unsupported = (await renderComponent(registration.Component, async () => ({
  ok: true,
  json: async () => ({
    updatedAt: Date.now(), error: 'bad-json', detail: 'response carried no included credit block', keyEnv: 'OLLAMA_CLOUD_API_KEY',
    balance: null, usage: null, usageError: null, usageDetail: null, keyEnvs: ['OLLAMA_CLOUD_API_KEY'], usageRange: '30d',
  }),
}), true)).text
check(unsupported.includes('応答を解析できませんでした'), 'unsupported response view surfaces the parse label')
check(unsupported.includes('no included credit block'), 'unsupported response view keeps the Host detail')

const usageDownView = (await renderComponent(registration.Component, async () => ({
  ok: true,
  json: async () => Object.assign({}, healthy.body, {
    updatedAt: Date.now(), keyEnv: 'OLLAMA_CLOUD_API_KEY', usageError: 'network', usageDetail: 'socket hang up',
  }),
}), true)).text
check(usageDownView.includes('利用状況を取得できませんでした'), 'a failed usage report renders inline while the credit card stays')
check(usageDownView.includes('$59.94'), 'a failed usage report keeps the credit card')

// Credentials editor: writes go through the shipped `credentials` Remote.
const credentialCalls = { describe: [], set: [], unset: [] }
let credentialView = {
  OLLAMA_CLOUD_API_KEY: { configured: false, writable: true },
  OLLAMA_API_KEY: { configured: false, writable: true },
}
const remoteFake = {
  credentials: {
    describe(payload) {
      credentialCalls.describe.push(payload)
      const credentials = {}
      for (const ref of payload.refs) credentials[ref] = credentialView[ref] || { configured: false, writable: true }
      return Promise.resolve({ result: { ok: true, value: { credentials } } })
    },
    set(payload) {
      credentialCalls.set.push(payload)
      credentialView = Object.assign({}, credentialView, { [payload.ref]: { configured: true, source: 'file', writable: true } })
      return Promise.resolve({ result: { ok: true, value: {} } })
    },
    unset(payload) {
      credentialCalls.unset.push(payload)
      credentialView = Object.assign({}, credentialView, { [payload.ref]: { configured: false, writable: true } })
      return Promise.resolve({ result: { ok: true, value: {} } })
    },
  },
}
let remoteRegistration
clientExports.apply({
  get: (name) => {
    if (name === 'slots') {
      return {
        inject: (slot, callback) => callback(),
        register: (options, Component) => { remoteRegistration = { options, Component }; return () => undefined },
      }
    }
    return name === 'remote' ? remoteFake : undefined
  },
})

const mounted = await renderComponent(remoteRegistration.Component, loadedSnapshot, true)
check(mounted.text.includes('API キー'), 'key editor renders when the credentials Remote exists')
check(credentialCalls.describe.length === 1, 'key editor describes the reference order on mount')
check(credentialCalls.describe[0].refs.join(',') === 'OLLAMA_CLOUD_API_KEY,OLLAMA_API_KEY', 'describe targets the snapshot reference order')

const input = findElements(mounted.tree, (node) => hasClass(node, 'oq-input'))[0]
check(input !== undefined, 'key editor renders a key input')
input.props.onChange({ target: { value: 'new-key-value' } })
const drafted = await renderComponent(remoteRegistration.Component, loadedSnapshot)
const saveButton = findElements(drafted.tree, (node) => hasClass(node, 'oq-primary'))[0]
check(saveButton !== undefined, 'key editor renders a save button')
saveButton.props.onClick()
const saved = await renderComponent(remoteRegistration.Component, loadedSnapshot)
check(credentialCalls.set.length === 1, 'save writes through credentials.set')
check(credentialCalls.set[0].ref === 'OLLAMA_CLOUD_API_KEY', 'save writes the primary reference')
check(credentialCalls.set[0].value === 'new-key-value', 'save writes the typed value')
check(saved.text.includes('保存しました') || credentialCalls.describe.length >= 2, 'save reloads the credential state')

const clearButton = findElements(saved.tree, (node) => hasClass(node, 'oq-btn') && Array.isArray(node.props.children) && node.props.children[0] === '削除')[0]
check(clearButton !== undefined, 'configured reference offers a clear control')
clearButton.props.onClick()
await renderComponent(remoteRegistration.Component, loadedSnapshot)
check(credentialCalls.unset.length === 1 && credentialCalls.unset[0].ref === 'OLLAMA_CLOUD_API_KEY', 'clear removes the primary reference')

// A read-only source disables the editor instead of writing to a fallback.
credentialView = {
  OLLAMA_CLOUD_API_KEY: { configured: true, source: 'env', writable: false },
  OLLAMA_API_KEY: { configured: false, writable: true },
}
const readonly = await renderComponent(remoteRegistration.Component, loadedSnapshot, true)
check(readonly.text.includes('読み取り専用'), 'read-only reference shows the environment warning')
check(findElements(readonly.tree, (node) => hasClass(node, 'oq-input')).length === 0, 'read-only reference renders no input')

// Locale service: dictionaries register and the nav label follows the active locale.
const localeRegistrations = []
let activeLocale = 'zh'
const localeFake = {
  register(ns, id, dict) { localeRegistrations.push({ ns, id, dict }); return () => undefined },
  bind() {
    return (key) => {
      const entry = localeRegistrations.find((item) => item.id === activeLocale)
      return entry && Object.prototype.hasOwnProperty.call(entry.dict, key) ? entry.dict[key] : key
    }
  },
}
let localeRegistration
clientExports.apply({
  get: (name) => (name === 'slots'
    ? { inject: (slot, callback) => callback(), register: (options, Component) => { localeRegistration = { options, Component }; return () => undefined } }
    : name === 'locale' ? localeFake : undefined),
  effect: (callback) => { callback(); return () => undefined },
})
check(localeRegistrations.length === 3, 'client registers Japanese, Chinese, and English dictionaries when the locale service exists')
check(localeRegistrations.map((item) => item.id).sort().join(',') === 'en,ja,zh', 'every shipped locale is registered')
check(localeRegistration.options.label() === 'Ollama 余额', 'nav label follows the active Chinese locale')
activeLocale = 'en'
check(localeRegistration.options.label() === 'Ollama credit', 'nav label follows an active locale switch')

// ------------------------------------------------------------------- live

if (LIVE) {
  const credentialsPath = join(process.env.DSH_HOME || join(homedir(), '.dsh'), '.credentials.yaml')
  let key
  try {
    const text = readFileSync(credentialsPath, 'utf8')
    const match = /^\s*OLLAMA_CLOUD_API_KEY:\s*(.+?)\s*$/m.exec(text)
    key = match && match[1].replace(/^['"]|['"]$/g, '')
  } catch (error) {
    check(false, `live: cannot read ${credentialsPath}: ${String(error)}`)
  }
  if (key) {
    const live = await hostSnapshot({ OLLAMA_CLOUD_API_KEY: key }, fetch, {}, true)
    check(live.body.error === null, `live: balance endpoint answers (error=${String(live.body.error)})`)
    if (live.body.balance) {
      check(typeof live.body.balance.includedUsd === 'number', 'live: remaining credit is a number')
      check(typeof live.body.balance.allowanceUsd === 'number', 'live: allowance is a number')
      check(typeof live.body.balance.purchasedUsd === 'number', 'live: purchased credit is a number')
      check(live.body.balance.period !== null, 'live: the allowance period is present')
      passes.push(`live balance: remaining=${String(live.body.balance.includedUsd)} allowance=${String(live.body.balance.allowanceUsd)} purchased=${String(live.body.balance.purchasedUsd)} period=${String(live.body.balance.period && live.body.balance.period.startingAt)}..${String(live.body.balance.period && live.body.balance.period.endingAt)}`)
    }
    check(live.body.usageError === null, `live: usage endpoint answers (error=${String(live.body.usageError)} detail=${String(live.body.usageDetail)})`)
    if (live.body.usage) {
      passes.push(`live usage: range=${String(live.body.usage.range)} spent=${String(live.body.usage.spentUsd)} requests=${String(live.body.usage.requests)} daily=${String(live.body.usage.daily.length)}`)
    }
  }
}

// -------------------------------------------------------------------- report

for (const message of passes) console.log('ok   ' + message)
for (const message of failures) console.error('FAIL ' + message)
console.log(`\n${passes.length} check(s) passed, ${failures.length} failed`)
process.exitCode = failures.length === 0 ? 0 : 1
