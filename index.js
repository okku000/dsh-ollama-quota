/**
 * dsh-ollama-quota — Host half.
 *
 * Reads the Ollama Cloud account credit and publishes one JSON snapshot on a
 * browser carrier for the Client half to render inside Settings.
 *
 * Data source (both endpoints take `Authorization: Bearer <Ollama Cloud key>`):
 *   GET https://ollama.com/api/balance  — the credit the account can still spend
 *   GET https://ollama.com/api/usage    — request/token/cost aggregates per range
 *
 * `balance` is the primary reading and carries the section:
 * `included.balance_usd` is the remaining share of `included.allowance_usd`
 * (the monthly included credit, `period.from` → `period.until`), and
 * `purchased.balance_usd` is separately bought credit. The former
 * `usage.limits.{session,weekly}` windows no longer exist on this endpoint;
 * Ollama moved the account to a credit balance and the older `limits` object
 * is gone, so a stale reader fails with "no limits object".
 *
 * `usage` is best effort and never fails the snapshot: its `totals` and daily
 * `buckets` describe spend over `usageRange`, which is the modern replacement
 * for the retired per-model request counts.
 *
 * Key lookup resolves credential references in order (`OLLAMA_CLOUD_API_KEY`
 * first, then `OLLAMA_API_KEY`), so a rotated key reaches the next refresh
 * without a restart. The key never leaves the Host: the route returns dollar
 * amounts, request and token counts, timestamps, and error labels only.
 *
 * Config (the plugin row's `config`):
 *   keyEnvs?:    string[]  credential references tried in order
 *   apiBase?:    string    API origin, default https://ollama.com
 *   usageRange?: string    usage window, one of 24h | 7d | 30d, default 30d
 *   refreshMs?:  number    snapshot refresh interval, default 60000 (minimum 5000)
 *   usageRefreshMs?: number  usage-report interval, default 300000 (minimum 60000)
 *   timeoutMs?:  number    per-request timeout, default 15000
 *
 * The Client half edits the first reference in `keyEnvs` through the shipped
 * settings/credentials Remote; writes never pass through this plugin's route.
 */

/** Ollama Cloud API origin. */
const DEFAULT_API_BASE = 'https://ollama.com'

/** Remaining-credit endpoint. */
const BALANCE_PATH = '/api/balance'

/** Usage-report endpoint; its `range` query selects the window. */
const USAGE_PATH = '/api/usage'

/** Browser route carrying the JSON snapshot to the Client half. */
const SNAPSHOT_PATH = '/ollama-quota/snapshot'

/** Credential lookup order: the first configured reference wins. */
const DEFAULT_KEY_ENVS = ['OLLAMA_CLOUD_API_KEY', 'OLLAMA_API_KEY']

/** POSIX shell identifier admitted as a credential reference. */
const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Windows the usage endpoint accepts; anything else is a 400. */
const USAGE_RANGES = ['24h', '7d', '30d']

/** Default usage window: the modern counterpart of the retired "last 4 weeks" cost. */
const DEFAULT_USAGE_RANGE = '30d'

/** Most daily buckets kept; the endpoint may answer a longer window. */
const MAX_DAILY_BUCKETS = 31

/**
 * Brand a POSIX identifier as a credential reference.
 *
 * Mirrors `credentialRef` from `@deepseek-ai/dsh-credentials`, which is a
 * compile-time brand plus this same identifier check; the provider uses the
 * reference as a map key and performs no runtime brand assertion. Inlining the
 * check keeps this bundle free of runtime imports it cannot resolve on its own.
 * @param value - candidate reference, such as `OLLAMA_CLOUD_API_KEY`.
 * @returns the reference accepted by `ctx.credentials`.
 */
function credentialRef(value) {
  if (!CREDENTIAL_REF_PATTERN.test(value)) {
    throw new TypeError(`credential ref "${value}" must match ${String(CREDENTIAL_REF_PATTERN)}`)
  }
  return value
}

/**
 * Coerce one wire number to a finite number.
 * @param value - candidate number or numeric string.
 * @returns the finite number, or null when the field is absent or not numeric.
 */
function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Coerce one wire timestamp to a string.
 * @param value - candidate ISO 8601 timestamp.
 * @returns the timestamp string, or null when the field is absent.
 */
function isoOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Project one `{from, until}` period.
 * @param raw - raw period object.
 * @returns the period, or null when neither endpoint names one.
 */
function pickPeriod(raw) {
  if (!raw || typeof raw !== 'object') return null
  const startingAt = isoOrNull(raw.from)
  const endingAt = isoOrNull(raw.until)
  return startingAt === null && endingAt === null ? null : { startingAt, endingAt }
}

/**
 * Project the credit balance response.
 * @param payload - parsed `GET /api/balance` body.
 * @returns the projected balance, or null when the response carries no credit block.
 */
function projectBalance(payload) {
  const included = payload && typeof payload === 'object' ? payload.included : null
  if (!included || typeof included !== 'object') return null
  const purchased = payload.purchased && typeof payload.purchased === 'object' ? payload.purchased : null
  const includedUsd = finiteOrNull(included.balance_usd)
  const allowanceUsd = finiteOrNull(included.allowance_usd)
  return {
    includedUsd,
    allowanceUsd,
    usedUsd: includedUsd === null || allowanceUsd === null
      ? null
      : Math.max(0, allowanceUsd - includedUsd),
    purchasedUsd: purchased === null ? null : finiteOrNull(purchased.balance_usd),
    period: pickPeriod(included.period),
  }
}

/**
 * Project the usage report response.
 * @param payload - parsed `GET /api/usage` body.
 * @param range - the requested window, echoed when the answer omits its own.
 * @returns the projected usage, or null when the response carries no aggregates.
 */
function projectUsage(payload, range) {
  if (!payload || typeof payload !== 'object') return null
  const totals = payload.totals && typeof payload.totals === 'object' ? payload.totals : null
  const buckets = Array.isArray(payload.buckets) ? payload.buckets : []
  if (totals === null && buckets.length === 0) return null
  const daily = buckets
    .slice(-MAX_DAILY_BUCKETS)
    .map((bucket) => ({
      from: bucket && typeof bucket === 'object' ? isoOrNull(bucket.from) : null,
      usd: bucket && typeof bucket === 'object' ? finiteOrNull(bucket.usage_usd) : null,
      requests: bucket && typeof bucket === 'object' ? finiteOrNull(bucket.request_count) : null,
    }))
    .filter((bucket) => bucket.from !== null)
  return {
    range: isoOrNull(payload.range) ?? range,
    startingAt: isoOrNull(payload.from),
    endingAt: isoOrNull(payload.until),
    spentUsd: totals === null ? null : finiteOrNull(totals.usage_usd),
    requests: totals === null ? null : finiteOrNull(totals.request_count),
    inputTokens: totals === null ? null : finiteOrNull(totals.input_tokens),
    cachedInputTokens: totals === null ? null : finiteOrNull(totals.cached_input_tokens),
    outputTokens: totals === null ? null : finiteOrNull(totals.output_tokens),
    daily,
  }
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'ollama-quota'

/** The credential seam and the harness timer the polling effect runs on. */
export const inject = ['credentials', 'timer']

/**
 * Mount the credit poller and its snapshot route.
 * @param ctx - Host plugin context.
 * @param config - plugin row configuration; every field has a documented default.
 */
export function apply(ctx, config = {}) {
  const keyEnvs = Array.isArray(config.keyEnvs) && config.keyEnvs.length > 0
    ? config.keyEnvs.slice()
    : DEFAULT_KEY_ENVS.slice()
  const apiBase = (typeof config.apiBase === 'string' && config.apiBase.length > 0
    ? config.apiBase
    : DEFAULT_API_BASE).replace(/\/+$/, '')
  const usageRange = USAGE_RANGES.includes(config.usageRange) ? config.usageRange : DEFAULT_USAGE_RANGE
  const refreshMs = Number.isFinite(config.refreshMs) && config.refreshMs >= 5000
    ? config.refreshMs
    : 60000
  const usageRefreshMs = Number.isFinite(config.usageRefreshMs) && config.usageRefreshMs >= 60000
    ? config.usageRefreshMs
    : 300000
  const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0
    ? config.timeoutMs
    : 15000
  const balanceUrl = apiBase + BALANCE_PATH
  const usageUrl = `${apiBase}${USAGE_PATH}?range=${usageRange}`

  let cache = {
    updatedAt: 0,
    error: 'loading',
    detail: null,
    keyEnv: null,
    balance: null,
    usage: null,
    usageError: null,
    usageDetail: null,
  }
  // The usage report is a wide window that barely moves, so it refreshes on
  // its own slower cadence and an ordinary balance tick reuses the last one.
  let usageCache = null
  let usageFetchedAt = 0
  let usageError = null
  let usageDetail = null
  let refreshing = null

  /**
   * Resolve the first configured Ollama Cloud key.
   * @returns the reference name and secret value, or null when none is configured.
   */
  async function resolveKey() {
    for (const env of keyEnvs) {
      const credential = await ctx.credentials.resolve(credentialRef(env))
      if (credential && credential.value) return { env, value: credential.value }
    }
    return null
  }

  /**
   * Fetch and parse one JSON endpoint.
   * @param key - resolved bearer token.
   * @param url - absolute request URL.
   * @returns the parsed payload plus a stable error label; never a rejection.
   */
  async function request(key, url) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
        signal: controller.signal,
      })
      if (response.status === 401 || response.status === 403) {
        return { error: 'unauthorized', detail: 'HTTP ' + response.status, payload: null }
      }
      if (response.status === 429) {
        return { error: 'rate-limited', detail: 'HTTP 429', payload: null }
      }
      if (!response.ok) {
        return { error: 'http-' + response.status, detail: 'HTTP ' + response.status, payload: null }
      }
      try {
        return { error: null, detail: null, payload: await response.json() }
      } catch {
        return { error: 'bad-json', detail: 'response is not JSON', payload: null }
      }
    } catch (error) {
      const message = error && error.name === 'AbortError' ? 'timeout' : String((error && error.message) || error)
      return { error: 'network', detail: message.slice(0, 200), payload: null }
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Rebuild the cache. Concurrent callers share one in-flight refresh.
   * @param forceUsage - re-read the usage report even when its own interval has not elapsed.
   * @returns the cache after this refresh settles.
   */
  async function refresh(forceUsage = false) {
    if (refreshing) return refreshing
    refreshing = (async () => {
      try {
        const key = await resolveKey()
        if (key === null) {
          usageCache = null
          usageFetchedAt = 0
          usageError = null
          usageDetail = null
          cache = {
            updatedAt: Date.now(),
            error: 'no-key',
            detail: null,
            keyEnv: null,
            balance: null,
            usage: null,
            usageError: null,
            usageDetail: null,
          }
          return
        }
        // Both endpoints are independent; the usage reading is advisory and
        // never overrides a healthy balance.
        const usageDue = forceUsage || Date.now() - usageFetchedAt >= usageRefreshMs
        const [balanceResponse, usageResponse] = await Promise.all([
          request(key.value, balanceUrl),
          usageDue ? request(key.value, usageUrl) : Promise.resolve(null),
        ])
        if (usageResponse !== null) {
          usageFetchedAt = Date.now()
          usageCache = usageResponse.payload === null ? null : projectUsage(usageResponse.payload, usageRange)
          usageError = usageResponse.error !== null
            ? usageResponse.error
            : usageCache === null ? 'bad-json' : null
          usageDetail = usageError === 'bad-json' && usageResponse.error === null
            ? 'response carried no usage aggregates'
            : usageResponse.detail
        }
        const balance = balanceResponse.payload === null ? null : projectBalance(balanceResponse.payload)
        const error = balanceResponse.error !== null
          ? balanceResponse.error
          : balance === null ? 'bad-json' : null
        cache = {
          updatedAt: Date.now(),
          error,
          detail: error === 'bad-json' && balanceResponse.error === null
            ? 'response carried no included credit block'
            : balanceResponse.detail,
          keyEnv: key.env,
          balance,
          usage: usageCache,
          usageError,
          usageDetail,
        }
      } catch (error) {
        cache = {
          ...cache,
          updatedAt: Date.now(),
          error: 'internal',
          detail: String((error && error.message) || error).slice(0, 200),
        }
      }
    })()
    try {
      await refreshing
    } finally {
      refreshing = null
    }
    return cache
  }

  refresh()
  ctx.interval(() => {
    refresh()
  }, refreshMs)

  // A key written through the settings UI reaches the next snapshot without
  // waiting out the polling interval, and always re-reads the usage report
  // because the previous reading belonged to the previous key.
  ctx.on('credentials/updated', () => {
    refresh(true)
  })

  const webServer = ctx.get('webServer')
  if (webServer !== undefined) {
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: SNAPSHOT_PATH,
      handler: async (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (url.searchParams.get('force') === '1') await refresh(true)
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        // `keyEnvs` and `usageRange` are deployment configuration, not secrets:
        // the Client half needs the reference order to describe and edit the
        // right key, and the window to label the usage rows.
        res.end(JSON.stringify({ ...cache, keyEnvs, usageRange }))
      },
    }), 'ollama-quota: snapshot route')
  }
}
