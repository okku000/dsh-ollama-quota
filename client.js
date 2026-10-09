/**
 * dsh-ollama-quota — Client half.
 *
 * Browser bundle in `window.__ModuleLoader__.load` form. It registers one
 * Settings section (`settings.section`, id `ollama-quota`) placed directly
 * below the shipped "Account / 账号与余额" entry, renders the Host snapshot from
 * `/ollama-quota/snapshot`, and edits the Ollama Cloud API key through the
 * shipped `credentials` Remote.
 *
 * Copy follows the app locale through `ctx.locale` when that service exists;
 * the browser language is only the fallback, because the Desktop renderer's
 * `navigator.language` need not match the UI locale.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ollama-quota',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    /** Locale namespace owned by this plugin. */
    const LOCALE_NS = 'ollama-quota'

    /** The API key charset DSH accepts: printable ASCII, no spaces. */
    const LEGAL_API_KEY = /^[\x21-\x7E]+$/

    const ja = {
      nav: 'Ollama 残高',
      balanceShort: '残高',
      usageShort: '30日利用',
      offPeakCard: 'オフピーク時間帯',
      offPeakActive: 'オフピーク中',
      peakActive: 'ピーク中（割増）',
      untilOffPeak: '開始まで',
      untilPeak: '終了まで',
      offPeakNow: '現在オフピーク',
      offPeakRule: '平日 12:00–18:00 UTC の外側と、週末は終日オフピーク',
      offPeakRuleShort: '平日12–18時UTC以外+週末終日',
      dayStrip: '本日の時間帯（塗り＝ピーク）',
      localPeak: '現地時間のピーク時間帯',
      nowClock: '現在時刻',
      title: 'Ollama Cloud 残高',
      credit: 'インクルード残高',
      creditHint: '月次の利用可能枠',
      remaining: '残り',
      ofCredit: '利用可能枠',
      used: '利用済み',
      period: '対象期間',
      purchased: '購入クレジット',
      usage: '利用状況',
      usageRange: '直近',
      requests: 'リクエスト数',
      inputTokens: '入力トークン',
      cachedTokens: 'キャッシュ入力',
      outputTokens: '出力トークン',
      spend: '費用',
      daily: '日別',
      usageUnavailable: '利用状況を取得できませんでした',
      loading: 'Ollama Cloud の残高を読み込んでいます…',
      fetchFailed: 'プラグインのスナップショットを読み取れません。再読み込みしてください。',
      noKey: 'Ollama Cloud の API キーが見つかりません。下の欄に入力するか、~/.dsh/.credentials.yaml の refs に設定してください。',
      noData: '応答に残高データが含まれていませんでした。',
      unauthorized: 'API キーが無効か、権限がありません (401/403)',
      network: 'ネットワーク要求に失敗しました',
      rateLimited: 'レート制限 (429)',
      timeout: '要求がタイムアウトしました',
      badJson: '応答を解析できませんでした',
      internal: 'Host 内部エラー',
      updated: '更新',
      refresh: '再読み込み',
      refreshing: '読み込み中…',
      unknown: '不明',
      keyTitle: 'API キー',
      keyDesc: 'Ollama Cloud の残高を読むために使います。この端末の DSH 資格情報ファイルに保存され、ページには表示されません。',
      keyConfigured: '設定済み',
      keyNotConfigured: '未設定',
      keyRefLabel: '参照名',
      keyPlaceholder: 'Ollama Cloud の API キーを貼り付け',
      keySave: '保存',
      keySaving: '保存中…',
      keyClear: '削除',
      keyClearing: '削除中…',
      keyEmpty: 'API キーを入力してください。',
      keyIllegal: 'API キーは空白を含まない印字可能 ASCII 文字のみです。',
      keySaved: '保存しました。残高を読み直しています…',
      keyCleared: '削除しました。',
      keyReadOnly: 'この参照は環境変数などの読み取り専用の提供元から来ています。先にその環境変数を外してください。',
      keyNoRemote: 'このクライアントからは資格情報を書き込めません。~/.dsh/.credentials.yaml の refs に手動で設定してください。',
    }
    const en = {
      nav: 'Ollama credit',
      balanceShort: 'Balance',
      usageShort: '30-day usage',
      offPeakCard: 'Off-peak window',
      offPeakActive: 'Off-peak',
      peakActive: 'Peak pricing',
      untilOffPeak: 'Starts in',
      untilPeak: 'Ends in',
      offPeakNow: 'off-peak now',
      offPeakRule: 'Off-peak outside 12:00–18:00 UTC on weekdays, and all day at weekends',
      offPeakRuleShort: 'weekdays 12–18 UTC excluded + weekends',
      dayStrip: 'Today in local time (shaded = peak)',
      localPeak: 'Peak window in local time',
      nowClock: 'Local time',
      title: 'Ollama Cloud credit',
      credit: 'Included credit',
      creditHint: 'monthly allowance',
      remaining: 'remaining',
      ofCredit: 'allowance',
      used: 'Used',
      period: 'Period',
      purchased: 'Purchased credit',
      usage: 'Usage',
      usageRange: 'last',
      requests: 'Requests',
      inputTokens: 'Input tokens',
      cachedTokens: 'Cached input',
      outputTokens: 'Output tokens',
      spend: 'Cost',
      daily: 'Per day',
      usageUnavailable: 'Could not read recent usage',
      loading: 'Reading the Ollama Cloud credit…',
      fetchFailed: 'Could not read the plugin snapshot. Refresh to retry.',
      noKey: 'No Ollama Cloud key found. Enter one below, or set it in refs of ~/.dsh/.credentials.yaml.',
      noData: 'The response carried no credit data.',
      unauthorized: 'Invalid key or no access (401/403)',
      network: 'Network request failed',
      rateLimited: 'Rate limited (429)',
      timeout: 'Request timed out',
      badJson: 'Could not parse the response',
      internal: 'Host internal error',
      updated: 'Updated',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      unknown: 'unknown',
      keyTitle: 'API key',
      keyDesc: 'Reads the Ollama Cloud credit. Stored in this machine\'s DSH credential file and never shown on this page.',
      keyConfigured: 'Configured',
      keyNotConfigured: 'Not configured',
      keyRefLabel: 'Reference',
      keyPlaceholder: 'Paste the Ollama Cloud API key',
      keySave: 'Save',
      keySaving: 'Saving…',
      keyClear: 'Clear',
      keyClearing: 'Clearing…',
      keyEmpty: 'Enter an API key.',
      keyIllegal: 'The API key must be printable ASCII without spaces.',
      keySaved: 'Saved. Re-reading the credit…',
      keyCleared: 'Cleared.',
      keyReadOnly: 'This reference comes from a read-only source such as an environment variable; remove that variable before editing it here.',
      keyNoRemote: 'This client cannot write credentials. Set the key manually in refs of ~/.dsh/.credentials.yaml.',
    }
    const zh = {
      nav: 'Ollama 余额',
      balanceShort: '余额',
      usageShort: '30天用量',
      offPeakCard: '低谷时段',
      offPeakActive: '低谷价中',
      peakActive: '高峰价中',
      untilOffPeak: '距开始',
      untilPeak: '距结束',
      offPeakNow: '当前为低谷',
      offPeakRule: '工作日 12:00–18:00 UTC 以外，以及整个周末均为低谷价',
      offPeakRuleShort: '工作日12–18时UTC以外+周末',
      dayStrip: '今日本地时间（填色为高峰）',
      localPeak: '本地时间的高峰时段',
      nowClock: '当前时间',
      title: 'Ollama Cloud 余额',
      credit: '包含额度',
      creditHint: '每月可用额度',
      remaining: '剩余',
      ofCredit: '可用额度',
      used: '已用',
      period: '统计区间',
      purchased: '购买余额',
      usage: '使用情况',
      usageRange: '最近',
      requests: '请求数',
      inputTokens: '输入 token',
      cachedTokens: '缓存输入',
      outputTokens: '输出 token',
      spend: '费用',
      daily: '按日',
      usageUnavailable: '无法读取使用情况',
      loading: '正在读取 Ollama Cloud 余额…',
      fetchFailed: '无法读取插件快照，请点击刷新重试。',
      noKey: '未找到 Ollama Cloud 密钥。请在下方填写，或在 ~/.dsh/.credentials.yaml 的 refs 中配置。',
      noData: '响应中没有可用的余额数据。',
      unauthorized: '密钥无效或无权访问（401/403）',
      network: '网络请求失败',
      rateLimited: '请求过于频繁（429）',
      timeout: '请求超时',
      badJson: '响应解析失败',
      internal: 'Host 内部错误',
      updated: '更新于',
      refresh: '刷新',
      refreshing: '刷新中…',
      unknown: '未知',
      keyTitle: 'API 密钥',
      keyDesc: '用于读取 Ollama Cloud 余额，保存在本机 DSH 凭据文件中，不会显示在页面上。',
      keyConfigured: '已配置',
      keyNotConfigured: '未配置',
      keyRefLabel: '引用',
      keyPlaceholder: '粘贴 Ollama Cloud API Key',
      keySave: '保存',
      keySaving: '保存中…',
      keyClear: '清除',
      keyClearing: '清除中…',
      keyEmpty: '请输入 API Key。',
      keyIllegal: 'API Key 只能包含可打印 ASCII 字符，且不能有空格。',
      keySaved: '已保存，正在重新读取余额…',
      keyCleared: '已清除。',
      keyReadOnly: '该引用由环境变量等只读来源提供，无法在界面修改；请先移除对应的环境变量。',
      keyNoRemote: '当前客户端无法写入凭据，请在 ~/.dsh/.credentials.yaml 的 refs 中手动配置。',
    }

    /**
     * Fallback lookup over one dictionary.
     * @param dict - locale dictionary.
     * @returns a translate function reading that dictionary.
     */
    function localTranslate(dict) {
      return (key) => Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key
    }

    const browserIsZh = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language || '')
    const browserIsJa = typeof navigator !== 'undefined' && /^ja/i.test(navigator.language || '')
    let t = browserIsZh ? localTranslate(zh) : browserIsJa ? localTranslate(ja) : localTranslate(en)
    /** Client Remote `credentials` namespace; undefined when the client has no credential face. */
    let credentials

    const CSS_ID = 'dsh-ollama-quota/css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + CSS_ID + '"]') === null) {
      const tag = document.createElement('style')
      tag.dataset.pluginCss = CSS_ID
      tag.textContent = `
.oq-section { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 22px; }
.oq-card { border: .5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2)); border-radius: var(--dsw-radius-xl, 12px); background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1)); padding: 12px 16px; }
.oq-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.oq-title { font-size: 14px; font-weight: 500; }
.oq-sub { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.oq-metric { display: flex; align-items: baseline; gap: 6px; margin-top: 8px; }
.oq-big { font-size: 26px; font-weight: 600; line-height: 1.1; }
.oq-unit { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.oq-bar { height: 6px; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; margin-top: 10px; }
.oq-bar-fill { height: 100%; border-radius: 3px; transition: width .3s ease; }
.oq-ok { background: var(--dsw-alias-state-success-primary); }
.oq-warn { background: var(--dsw-alias-state-warn-primary); }
.oq-err { background: var(--dsw-alias-state-error-primary); }
.oq-na { background: var(--dsw-alias-state-idle-primary); }
.oq-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; box-sizing: border-box; min-height: 32px; padding: 4px 0; }
.oq-divider { border-top: .5px solid var(--dsw-alias-border-l2); margin-top: 6px; }
.oq-spark { display: flex; align-items: flex-end; gap: 2px; height: 34px; margin-top: 8px; }
.oq-spark-bar { flex: 1 1 0; min-width: 2px; border-radius: 2px; background: var(--dsw-alias-brand-primary); opacity: .75; }
.oq-spark-bar.oq-na { opacity: .3; }
.oq-mono { font-variant-numeric: tabular-nums; }
.oq-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; }
.oq-note { color: var(--dsw-alias-state-success-primary); font-size: 12px; }
.oq-warn-text { color: var(--dsw-alias-state-warn-primary); }
.oq-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.oq-btn { box-sizing: border-box; border: .5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 6px); background: transparent; color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 20px; padding: 3px 10px; cursor: pointer; }
.oq-btn:hover { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); }
.oq-btn:disabled { color: var(--dsw-alias-label-secondary); cursor: default; }
.oq-primary { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.oq-field { display: flex; gap: 8px; margin-top: 8px; }
.oq-input { box-sizing: border-box; flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: .5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 6px); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 13px; }
.oq-input:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 1px; }
.oq-actions { display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end; }
.oq-side { display: flex; flex: 1 1 auto; flex-direction: column; gap: 3px; box-sizing: border-box; min-width: 0; width: 100%; padding: 8px 10px; border: .5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2)); border-radius: var(--dsw-radius-lg, 10px); background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1)); color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 16px; }
.oq-side-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; }
.oq-side-balance { font-size: 14px; font-weight: 600; }
.oq-side-sub { color: var(--dsw-alias-label-secondary); font-size: 11px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oq-side-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.oq-side-dot { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; vertical-align: middle; }
.oq-side-note { color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 13px; }
.oq-strip { margin-top: 4px; }
.oq-strip-track { position: relative; height: 8px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.oq-strip-peak { position: absolute; top: 0; bottom: 0; background: var(--dsw-alias-state-warn-primary); opacity: .5; }
.oq-strip-now { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--dsw-alias-label-primary); }
.oq-strip-ticks { display: flex; justify-content: space-between; margin-top: 2px; color: var(--dsw-alias-label-secondary); font-size: 9px; line-height: 10px; }
.oq-side-rail { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 0; color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 13px; }
.oq-side-rail .oq-side-balance { font-size: 11px; }
`
      document.head.appendChild(tag)
    }

    const API = '/ollama-quota/snapshot'

    /**
     * Sidebar snapshot poll: one 60s fetch shared by the footer widget, plus a
     * 5s clock tick that re-renders the minute-granularity countdowns.
     */
    const sidebarStore = {
      status: 'loading',
      data: null,
      listeners: new Set(),
      snapshotTimer: null,
      clockTimer: null,
      subscribe(listener) {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
      emit() {
        for (const listener of [...this.listeners]) listener()
      },
      start() {
        if (this.snapshotTimer !== null) return
        this.load()
        this.snapshotTimer = setInterval(() => { this.load() }, 60000)
        this.clockTimer = setInterval(() => { this.emit() }, 5000)
      },
      stop() {
        if (this.snapshotTimer !== null) clearInterval(this.snapshotTimer)
        if (this.clockTimer !== null) clearInterval(this.clockTimer)
        this.snapshotTimer = null
        this.clockTimer = null
      },
      load() {
        fetch(API, { cache: 'no-store' })
          .then((response) => response.ok ? response.json() : Promise.reject(new Error('HTTP ' + response.status)))
          .then((data) => { this.data = data; this.status = 'ready'; this.emit() })
          .catch(() => { this.status = 'failed'; this.emit() })
      },
    }

    /** First minute of the weekday peak window, in UTC minutes-of-day. */
    const PEAK_START_MINUTE = 12 * 60

    /** First minute after the weekday peak window, in UTC minutes-of-day. */
    const PEAK_END_MINUTE = 18 * 60

    /** Milliseconds in one day; UTC has no DST, so this is exact. */
    const DAY_MS = 86400000

    /**
     * Resolve the next weekday 12:00 UTC strictly after one instant — the only
     * way into peak pricing. Weekends are off-peak, so a Friday-evening,
     * Saturday, or Sunday instant resolves to the following Monday.
     * @param fromMs - epoch milliseconds to look forward from.
     * @returns the peak start, or null when the search window is exhausted.
     */
    function nextPeakStart(fromMs) {
      const from = new Date(fromMs)
      let dayStart = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
      for (let step = 0; step < 8; step++) {
        const candidate = dayStart + PEAK_START_MINUTE * 60000
        const weekday = new Date(candidate).getUTCDay()
        if (weekday !== 0 && weekday !== 6 && candidate > fromMs) return candidate
        dayStart += DAY_MS
      }
      return null
    }

    /**
     * Resolve the last weekday 18:00 UTC at or before one instant — the moment
     * the running off-peak stretch began. A Monday-morning, Saturday, or Sunday
     * instant resolves to the preceding Friday.
     * @param fromMs - epoch milliseconds to look back from.
     * @returns the off-peak start, or null when the search window is exhausted.
     */
    function previousPeakEnd(fromMs) {
      const from = new Date(fromMs)
      let dayStart = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
      for (let step = 0; step < 8; step++) {
        const candidate = dayStart + PEAK_END_MINUTE * 60000
        const weekday = new Date(candidate).getUTCDay()
        if (weekday !== 0 && weekday !== 6 && candidate <= fromMs) return candidate
        dayStart -= DAY_MS
      }
      return null
    }

    /**
     * Project the current Ollama price period. Peak pricing runs on weekdays
     * from 12:00 to 18:00 UTC; every other instant is off-peak.
     * @param nowMs - epoch milliseconds.
     * @returns peak flag, the current period bounds, and the surrounding
     *   off-peak bounds (epoch ms), which drive the bars and the countdowns.
     */
    function offPeakState(nowMs) {
      const now = new Date(nowMs)
      const weekday = now.getUTCDay() !== 0 && now.getUTCDay() !== 6
      const minute = now.getUTCHours() * 60 + now.getUTCMinutes()
      const peak = weekday && minute >= PEAK_START_MINUTE && minute < PEAK_END_MINUTE
      const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      if (peak) {
        const peakStart = dayStart + PEAK_START_MINUTE * 60000
        const peakEnd = dayStart + PEAK_END_MINUTE * 60000
        return {
          peak: true,
          periodStart: peakStart,
          periodEnd: peakEnd,
          offPeakStart: peakEnd,
          offPeakEnd: nextPeakStart(peakEnd),
        }
      }
      const offPeakEnd = nextPeakStart(nowMs)
      return {
        peak: false,
        periodStart: previousPeakEnd(nowMs),
        periodEnd: offPeakEnd,
        offPeakStart: null,
        offPeakEnd,
      }
    }

    /**
     * Format one remaining duration at minute granularity. Rounded up, so a
     * running period never reads `0分` before its boundary passes.
     * @param ms - milliseconds remaining.
     * @returns `H時間M分`, `H時間`, or `M分`.
     */
    function fmtCountdown(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '0分'
      const minutes = Math.max(1, Math.ceil(ms / 60000))
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      if (hours > 0) return rest === 0 ? hours + '時間' : hours + '時間' + rest + '分'
      return minutes + '分'
    }

    /**
     * Format one remaining duration for the collapsed rail, minutes only.
     * @param ms - milliseconds remaining.
     * @returns `H:MM` or `M分`.
     */
    function fmtCompact(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '0分'
      const minutes = Math.max(1, Math.ceil(ms / 60000))
      const hours = Math.floor(minutes / 60)
      return hours > 0 ? hours + ':' + String(minutes % 60).padStart(2, '0') : minutes + '分'
    }

    /**
     * Format one instant as local wall-clock time.
     * @param nowMs - epoch milliseconds.
     * @returns `HH:MM` on the browser's clock.
     */
    function fmtClock(nowMs) {
      const date = new Date(nowMs)
      return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')
    }

    /**
     * Format a dollar amount with two decimals.
     * @param value - dollar amount.
     * @returns the formatted amount, or the placeholder dash.
     */
    function usd(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return '$' + value.toFixed(2)
    }

    /**
     * Format an integer count with thousands separators.
     * @param value - request or token count.
     * @returns the formatted count, or the placeholder dash.
     */
    function count(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return Math.round(value).toLocaleString()
    }

    /**
     * Format an ISO 8601 timestamp as a local calendar date.
     * @param value - ISO 8601 timestamp.
     * @returns the date, or the placeholder dash.
     */
    function fmtDate(value) {
      if (typeof value !== 'string' || value.length === 0) return '—'
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toLocaleDateString()
    }

    /**
     * Format one snapshot timestamp.
     * @param timestamp - epoch milliseconds.
     * @returns a local clock time, or the placeholder dash.
     */
    function fmtTime(timestamp) {
      if (typeof timestamp !== 'number' || timestamp <= 0) return '—'
      return new Date(timestamp).toLocaleTimeString()
    }

    /**
     * Severity class for a used fraction.
     * @param fraction - raw used fraction in [0, 1].
     * @returns a bar fill class suffix.
     */
    function level(fraction) {
      if (typeof fraction !== 'number' || !Number.isFinite(fraction)) return 'na'
      if (fraction >= 0.85) return 'err'
      if (fraction >= 0.6) return 'warn'
      return 'ok'
    }

    /**
     * Clamp a fraction into [0, 1].
     * @param fraction - candidate fraction.
     * @returns the clamped fraction, or null when it is not a finite number.
     */
    function clamp01(fraction) {
      if (typeof fraction !== 'number' || !Number.isFinite(fraction)) return null
      return Math.max(0, Math.min(1, fraction))
    }

    /**
     * Judge the key input. An empty field is a failure here because the editor
     * has no "keep the stored key" meaning — clearing is its own control.
     * @param value - the input's current value.
     * @returns a localized failure message, or undefined to allow submit.
     */
    function keyFailure(value) {
      const trimmed = value.trim()
      if (trimmed.length === 0) return t('keyEmpty')
      if (!LEGAL_API_KEY.test(trimmed)) return t('keyIllegal')
      return undefined
    }

    /**
     * Localize one Host error label.
     * @param code - Host error label such as `network`, `rate-limited`, or `http-500`.
     * @returns display text.
     */
    function errText(code) {
      if (typeof code === 'string' && code.indexOf('http-') === 0) return 'HTTP ' + code.slice(5)
      const map = {
        unauthorized: t('unauthorized'),
        network: t('network'),
        'rate-limited': t('rateLimited'),
        timeout: t('timeout'),
        'bad-json': t('badJson'),
        internal: t('internal'),
      }
      return map[code] || (code || t('unknown'))
    }

    /**
     * Localize one usage window id.
     * @param range - `24h`, `7d`, or `30d`.
     * @returns the window label such as `直近30日`.
     */
    function fmtRange(range) {
      const unit = range === '24h' ? '24h' : range === '7d' ? '7d' : range === '30d' ? '30d' : (range || '')
      return unit.length === 0 ? '' : t('usageRange') + unit
    }

    /**
     * Plain message card.
     * @param props - message text, optionally an error style flag.
     * @returns the card element.
     */
    function NoticeCard(props) {
      return React.createElement('div', { className: 'oq-card' },
        React.createElement('div', { className: props.error ? 'oq-error' : 'oq-sub' }, props.message))
    }

    /**
     * Remaining-credit card: the allowance still available for the period.
     * @param props - the projected balance.
     * @returns the card element.
     */
    function CreditCard(props) {
      const balance = props.balance
      const allowance = balance && typeof balance.allowanceUsd === 'number' ? balance.allowanceUsd : null
      const remaining = balance && typeof balance.includedUsd === 'number' ? balance.includedUsd : null
      const used = allowance !== null && allowance > 0 && remaining !== null
        ? clamp01((allowance - remaining) / allowance)
        : null
      const period = balance && balance.period
      const rows = []
      rows.push(React.createElement('div', { className: 'oq-head', key: 'head' },
        React.createElement('span', { className: 'oq-title' }, t('credit')),
        React.createElement('span', { className: 'oq-sub' }, t('creditHint'))))
      rows.push(React.createElement('div', { className: 'oq-metric', key: 'metric' },
        React.createElement('span', { className: 'oq-big oq-mono' }, usd(remaining)),
        React.createElement('span', { className: 'oq-unit' }, t('remaining') + (allowance === null ? '' : ' / ' + usd(allowance)))))
      rows.push(React.createElement('div', { className: 'oq-bar', key: 'bar' },
        React.createElement('div', {
          className: 'oq-bar-fill oq-' + level(used),
          style: { width: (used === null ? 0 : used * 100) + '%' },
        })))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'used' },
        React.createElement('span', { className: 'oq-sub' }, t('used')),
        React.createElement('span', { className: 'oq-mono' }, usd(balance && balance.usedUsd))))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'purchased' },
        React.createElement('span', { className: 'oq-sub' }, t('purchased')),
        React.createElement('span', { className: 'oq-mono' }, usd(balance && balance.purchasedUsd))))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'period' },
        React.createElement('span', { className: 'oq-sub' }, t('period')),
        React.createElement('span', { className: 'oq-sub oq-mono' }, period && (period.startingAt || period.endingAt)
          ? fmtDate(period.startingAt) + ' → ' + fmtDate(period.endingAt)
          : '—')))
      return React.createElement('div', { className: 'oq-card' }, rows)
    }

    /**
     * Daily spend strip; two points are the minimum for a shape to mean anything.
     * @param props - the projected usage.
     * @returns the strip element, or null when the report has no shape to draw.
     */
    function Sparkline(props) {
      const daily = props.usage && Array.isArray(props.usage.daily) ? props.usage.daily : []
      if (daily.length < 2) return null
      const amounts = daily.map((bucket) => typeof bucket.usd === 'number' && Number.isFinite(bucket.usd) ? bucket.usd : 0)
      const peak = Math.max.apply(null, amounts)
      const bars = daily.map((bucket, index) => {
        const amount = amounts[index]
        const height = peak > 0 ? Math.max(2, Math.round((amount / peak) * 34)) : 2
        return React.createElement('div', {
          className: 'oq-spark-bar' + (amount > 0 ? '' : ' oq-na'),
          key: bucket.from + ':' + index,
          style: { height: height + 'px' },
          title: fmtDate(bucket.from) + ' · ' + usd(amount) + ' · ' + count(bucket.requests),
        })
      })
      return React.createElement('div', { className: 'oq-spark' }, bars)
    }

    /**
     * Usage-report card: spend, request count, and token totals over one window.
     * @param props - the projected usage plus its non-fatal error labels.
     * @returns the card element.
     */
    function UsageCard(props) {
      const usage = props.usage
      const rows = []
      rows.push(React.createElement('div', { className: 'oq-head', key: 'head' },
        React.createElement('span', { className: 'oq-title' }, t('usage')),
        React.createElement('span', { className: 'oq-sub' }, fmtRange(props.range))))
      if (props.error) {
        rows.push(React.createElement('div', { className: 'oq-error', key: 'error' },
          t('usageUnavailable') + ' · ' + errText(props.error) + (props.detail ? ' · ' + props.detail : '')))
        return React.createElement('div', { className: 'oq-card' }, rows)
      }
      rows.push(React.createElement('div', { className: 'oq-metric', key: 'metric' },
        React.createElement('span', { className: 'oq-big oq-mono' }, usd(usage && usage.spentUsd)),
        React.createElement('span', { className: 'oq-unit' }, t('spend'))))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'requests' },
        React.createElement('span', { className: 'oq-sub' }, t('requests')),
        React.createElement('span', { className: 'oq-mono' }, count(usage && usage.requests))))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'input' },
        React.createElement('span', { className: 'oq-sub' }, t('inputTokens')),
        React.createElement('span', { className: 'oq-mono' }, count(usage && usage.inputTokens))))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'cached' },
        React.createElement('span', { className: 'oq-sub' }, t('cachedTokens')),
        React.createElement('span', { className: 'oq-mono' }, count(usage && usage.cachedInputTokens))))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'output' },
        React.createElement('span', { className: 'oq-sub' }, t('outputTokens')),
        React.createElement('span', { className: 'oq-mono' }, count(usage && usage.outputTokens))))
      if (usage && usage.startingAt && usage.endingAt) {
        rows.push(React.createElement('div', { className: 'oq-row', key: 'span' },
          React.createElement('span', { className: 'oq-sub' }, t('period')),
          React.createElement('span', { className: 'oq-sub oq-mono' },
            fmtDate(usage.startingAt) + ' → ' + fmtDate(usage.endingAt))))
      }
      const spark = React.createElement(Sparkline, { key: 'spark', usage })
      if (spark !== null) {
        rows.push(React.createElement('div', { className: 'oq-divider', key: 'divider' }))
        rows.push(React.createElement('div', { className: 'oq-row', key: 'dailylabel' },
          React.createElement('span', { className: 'oq-sub' }, t('daily'))))
        rows.push(spark)
      }
      return React.createElement('div', { className: 'oq-card' }, rows)
    }

    /**
     * API key card. Pure: every fact and callback arrives from the section.
     * @param props - credential state, draft value, and handlers.
     * @returns the card element.
     */
    function ApiKeyCard(props) {
      const rows = []
      rows.push(React.createElement('div', { className: 'oq-head', key: 'head' },
        React.createElement('span', { className: 'oq-title' }, t('keyTitle')),
        props.primaryInfo
          ? React.createElement('span', { className: 'oq-sub' },
              (props.primaryInfo.configured ? t('keyConfigured') : t('keyNotConfigured'))
              + (props.primaryInfo.source ? ' · ' + props.primaryInfo.source : ''))
          : null))

      rows.push(React.createElement('div', { className: 'oq-sub', key: 'desc' }, t('keyDesc')))
      if (props.primaryRef !== null) {
        rows.push(React.createElement('div', { className: 'oq-row', key: 'ref' },
          React.createElement('span', { className: 'oq-sub' }, t('keyRefLabel')),
          React.createElement('span', { className: 'oq-sub oq-mono' }, props.primaryRef)))
      }

      if (!props.remoteAvailable) {
        rows.push(React.createElement('div', { className: 'oq-sub', key: 'noremote' }, t('keyNoRemote')))
        return React.createElement('div', { className: 'oq-card' }, rows)
      }

      if (!props.editable) {
        rows.push(React.createElement('div', { className: 'oq-sub oq-warn-text', key: 'readonly' }, t('keyReadOnly')))
      } else {
        rows.push(React.createElement('div', { className: 'oq-field', key: 'field' },
          React.createElement('input', {
            className: 'oq-input',
            type: 'password',
            autoComplete: 'off',
            spellCheck: false,
            placeholder: t('keyPlaceholder'),
            value: props.draft,
            onChange: (event) => props.onDraftChange(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') props.onSave() },
          })))
        const actions = [React.createElement('button', {
          className: 'oq-btn oq-primary',
          type: 'button',
          key: 'save',
          disabled: props.busy || props.draft.length === 0,
          onClick: () => props.onSave(),
        }, props.busy ? t('keySaving') : t('keySave'))]
        if (props.primaryInfo && props.primaryInfo.configured) {
          actions.push(React.createElement('button', {
            className: 'oq-btn',
            type: 'button',
            key: 'clear',
            disabled: props.busy,
            onClick: () => props.onClear(),
          }, props.busy ? t('keyClearing') : t('keyClear')))
        }
        rows.push(React.createElement('div', { className: 'oq-actions', key: 'actions' }, actions))
      }

      if (props.error) rows.push(React.createElement('div', { className: 'oq-error', key: 'err' }, props.error))
      else if (props.message) rows.push(React.createElement('div', { className: 'oq-note', key: 'msg' }, props.message))
      else if (props.describeError) rows.push(React.createElement('div', { className: 'oq-error', key: 'derr' }, props.describeError))

      return React.createElement('div', { className: 'oq-card' }, rows)
    }

    /**
     * Peak intervals inside one local day, as fractions of that day. The rule
     * is anchored in UTC, so a zone whose offset moves the window across local
     * midnight (JST puts 12:00-18:00 UTC at 21:00-03:00) yields two bands.
     * @param nowMs - instant whose local day is charted.
     * @returns band fractions `{ left, width }` in [0, 1].
     */
    function peakBands(nowMs) {
      const now = new Date(nowMs)
      const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const localEnd = localStart + DAY_MS
      const bands = []
      // Two UTC days can reach into one local day, so start one day early.
      let dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY_MS
      for (let step = 0; step < 3; step++) {
        const weekday = new Date(dayStart).getUTCDay()
        if (weekday !== 0 && weekday !== 6) {
          const from = Math.max(dayStart + PEAK_START_MINUTE * 60000, localStart)
          const until = Math.min(dayStart + PEAK_END_MINUTE * 60000, localEnd)
          if (until > from) bands.push({ left: (from - localStart) / DAY_MS, width: (until - from) / DAY_MS })
        }
        dayStart += DAY_MS
      }
      return bands
    }

    /**
     * This browser's zone abbreviation, for labeling the local-time axis.
     * @returns the short zone name, or `local` when the runtime names none.
     */
    function localZoneLabel() {
      try {
        const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date())
        const found = parts.find((part) => part.type === 'timeZoneName')
        return found && found.value ? found.value : 'local'
      } catch {
        return 'local'
      }
    }

    /**
     * The peak window in local wall-clock time. With a positive offset the end
     * crosses local midnight, so it is reported modulo one day.
     * @returns `HH:MM-HH:MM`.
     */
    function localPeakWindow() {
      const offset = -new Date().getTimezoneOffset()
      const clock = (minutes) => {
        const wrapped = ((minutes % 1440) + 1440) % 1440
        return String(Math.floor(wrapped / 60)).padStart(2, '0') + ':' + String(wrapped % 60).padStart(2, '0')
      }
      return clock(PEAK_START_MINUTE + offset) + '-' + clock(PEAK_END_MINUTE + offset)
    }

    /**
     * One 24h strip on the browser's local clock: the peak bands mapped from
     * the UTC rule, a cursor at the current local time, and hour ticks.
     * @returns the strip element.
     */
    function DayStrip() {
      const nowMs = Date.now()
      const now = new Date(nowMs)
      const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const cursor = ((nowMs - localStart) / DAY_MS) * 100
      const zones = peakBands(nowMs).map((band, index) => React.createElement('div', {
        className: 'oq-strip-peak',
        key: 'band' + index,
        style: { left: (band.left * 100) + '%', width: (band.width * 100) + '%' },
      }))
      const ticks = ['0', '6', '12', '18', '24'].map((hour) => React.createElement('span', { key: hour }, hour))
      return React.createElement('div', { className: 'oq-strip' },
        React.createElement('div', {
          className: 'oq-strip-track',
          title: t('offPeakRule') + ' · ' + localPeakWindow() + ' ' + localZoneLabel(),
        }, zones.concat([React.createElement('div', {
          className: 'oq-strip-now',
          key: 'now',
          style: { left: cursor + '%' },
        })])),
        React.createElement('div', { className: 'oq-strip-ticks' },
          React.createElement('span', { key: 'clock' }, fmtClock(nowMs) + ' ' + localZoneLabel()),
          ticks))
    }

    /**
     * Sidebar-footer widget, always visible above Settings: the remaining
     * credit, the recent spend, and the current price period as bars — a
     * progress meter for the running period plus the 24h UTC peak strip.
     * @param props - owner props; `wide: false` renders the 56px rail form.
     * @returns the widget element.
     */
    function SidebarQuota(props) {
      const [, force] = React.useState(0)
      React.useEffect(() => sidebarStore.subscribe(() => force((value) => value + 1)), [])
      const data = sidebarStore.data
      const balance = data && data.balance ? data.balance : null
      const usage = data && data.usage ? data.usage : null
      const remaining = balance ? usd(balance.includedUsd) : '—'
      const spent = usage ? usd(usage.spentUsd) : '—'
      const now = Date.now()
      const period = offPeakState(now)
      const countdown = period.peak ? fmtCountdown(period.offPeakStart - now) : fmtCountdown(period.offPeakEnd - now)
      const status = period.peak ? t('peakActive') : t('offPeakActive')
      const boundary = (period.peak ? t('untilOffPeak') : t('untilPeak')) + ' ' + countdown
      if (props && props.wide === false) {
        return React.createElement('div', { className: 'oq-side-rail', title: status + ' · ' + boundary + ' · ' + t('offPeakRuleShort') },
          React.createElement('span', { className: 'oq-side-balance oq-mono' }, remaining),
          React.createElement('span', { className: 'oq-mono' },
            React.createElement('span', { className: 'oq-side-dot oq-' + (period.peak ? 'warn' : 'ok') }),
            fmtCompact(period.peak ? period.offPeakStart - now : period.offPeakEnd - now)))
      }
      return React.createElement('div', { className: 'oq-side' },
        React.createElement('div', { className: 'oq-side-head' },
          React.createElement('span', { className: 'oq-side-sub' }, t('balanceShort')),
          React.createElement('span', { className: 'oq-side-balance oq-mono' }, remaining)),
        React.createElement('div', { className: 'oq-side-head' },
          React.createElement('span', { className: 'oq-side-sub' }, t('usageShort')),
          React.createElement('span', { className: 'oq-mono' }, spent)),
        React.createElement('div', { className: 'oq-side-row' },
          React.createElement('span', { className: 'oq-side-sub' },
            React.createElement('span', { className: 'oq-side-dot oq-' + (period.peak ? 'warn' : 'ok') }),
            status),
          React.createElement('span', { className: 'oq-mono' }, countdown)),
        React.createElement(DayStrip, { key: 'strip' }))
    }

    /**
     * Settings card for the price schedule: the rule plus both countdowns.
     * @returns the card element.
     */
    function OffPeakCard() {
      const now = Date.now()
      const period = offPeakState(now)
      const rows = []
      rows.push(React.createElement('div', { className: 'oq-head', key: 'head' },
        React.createElement('span', { className: 'oq-title' }, t('offPeakCard')),
        React.createElement('span', { className: 'oq-sub' }, period.peak ? t('peakActive') : t('offPeakActive'))))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'rule' },
        React.createElement('span', { className: 'oq-sub' }, t('offPeakRule'))))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'start' },
        React.createElement('span', { className: 'oq-sub' }, t('untilOffPeak')),
        React.createElement('span', { className: 'oq-mono' }, period.peak
          ? fmtCountdown(period.offPeakStart - now)
          : t('offPeakNow'))))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'end' },
        React.createElement('span', { className: 'oq-sub' }, t('untilPeak')),
        React.createElement('span', { className: 'oq-mono' }, fmtCountdown(period.offPeakEnd - now))))
      rows.push(React.createElement('div', { className: 'oq-divider', key: 'divider' }))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'clock' },
        React.createElement('span', { className: 'oq-sub' }, t('nowClock')),
        React.createElement('span', { className: 'oq-sub oq-mono' }, fmtClock(now) + ' ' + localZoneLabel())))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'localpeak' },
        React.createElement('span', { className: 'oq-sub' }, t('localPeak')),
        React.createElement('span', { className: 'oq-sub oq-mono' }, localPeakWindow() + ' ' + localZoneLabel())))
      rows.push(React.createElement('div', { className: 'oq-row', key: 'striplabel' },
        React.createElement('span', { className: 'oq-sub' }, t('dayStrip')),
        React.createElement('span', { className: 'oq-sub' }, '0 → 24 ' + localZoneLabel())))
      rows.push(React.createElement(DayStrip, { key: 'strip' }))
      return React.createElement('div', { className: 'oq-card' }, rows)
    }

    /** The registered Settings section. */
    function OllamaQuotaSection() {
      const [state, setState] = React.useState({ status: 'loading', data: null })
      const [busy, setBusy] = React.useState(false)
      const [keyState, setKeyState] = React.useState({ status: 'idle', refs: {}, refsList: [], error: null })
      const [draft, setDraft] = React.useState('')
      const [keyBusy, setKeyBusy] = React.useState(false)
      const [keyError, setKeyError] = React.useState(null)
      const [keyMessage, setKeyMessage] = React.useState(null)
      const [, setClock] = React.useState(0)

      const load = React.useCallback((force) => {
        if (force) setBusy(true)
        fetch(API + (force ? '?force=1' : ''), { cache: 'no-store' })
          .then((response) => response.ok ? response.json() : Promise.reject(new Error('HTTP ' + response.status)))
          .then((data) => setState({ status: 'ready', data }))
          .catch(() => setState({ status: 'failed', data: null }))
          .finally(() => { if (force) setBusy(false) })
      }, [])

      const refreshKey = React.useCallback((refsList) => {
        if (credentials === undefined || !Array.isArray(refsList) || refsList.length === 0) {
          setKeyState({ status: credentials === undefined ? 'unavailable' : 'idle', refs: {}, refsList: refsList || [], error: null })
          return
        }
        setKeyState({ status: 'loading', refs: {}, refsList, error: null })
        // One microtask between render and the Remote call: a denied namespace
        // accessor or a transport throw lands in the catch instead of escaping
        // the effect (which would blank the whole section).
        Promise.resolve()
          .then(() => credentials.describe(refsList))
          .then((response) => {
            if (response && response.ok) {
              setKeyState({ status: 'ready', refs: response.value || {}, refsList, error: null })
            } else {
              setKeyState({
                status: 'error',
                refs: {},
                refsList,
                error: (response && response.error && response.error.message) || 'describe failed',
              })
            }
          })
          .catch((error) => {
            setKeyState({ status: 'error', refs: {}, refsList, error: String((error && error.message) || error) })
          })
      }, [])

      React.useEffect(() => {
        load(false)
        const id = setInterval(() => load(false), 60000)
        return () => clearInterval(id)
      }, [load])

      // The clock and the minute countdowns tick every 5s; the snapshot itself
      // stays on its own 60s cadence.
      React.useEffect(() => {
        const id = setInterval(() => setClock((value) => value + 1), 5000)
        return () => clearInterval(id)
      }, [])

      const data = state.data
      const refsKey = data && Array.isArray(data.keyEnvs) ? data.keyEnvs.join(',') : ''
      React.useEffect(() => {
        refreshKey(refsKey.length > 0 ? refsKey.split(',') : [])
      }, [refsKey, refreshKey])

      const refsList = keyState.refsList
      const primaryRef = refsList.length > 0 ? refsList[0] : null
      const primaryInfo = primaryRef === null ? undefined : keyState.refs[primaryRef]
      const editable = primaryInfo !== undefined && primaryInfo.writable === true

      const saveKey = () => {
        if (credentials === undefined || primaryRef === null || !editable) return
        const failure = keyFailure(draft)
        if (failure !== undefined) {
          setKeyError(failure)
          setKeyMessage(null)
          return
        }
        setKeyBusy(true)
        setKeyError(null)
        setKeyMessage(null)
        Promise.resolve()
          .then(() => credentials.set(primaryRef, draft.trim()))
          .then((response) => {
            if (response && response.ok) {
              setDraft('')
              setKeyMessage(t('keySaved'))
              refreshKey(refsList)
              load(true)
            } else {
              setKeyError((response && response.error && response.error.message) || t('unknown'))
            }
          })
          .catch((error) => {
            setKeyError(String((error && error.message) || error))
          })
          .finally(() => { setKeyBusy(false) })
      }

      const clearKey = () => {
        if (credentials === undefined || primaryRef === null || !editable) return
        setKeyBusy(true)
        setKeyError(null)
        setKeyMessage(null)
        Promise.resolve()
          .then(() => credentials.unset(primaryRef))
          .then((response) => {
            if (response && response.ok) {
              setDraft('')
              setKeyMessage(t('keyCleared'))
              refreshKey(refsList)
              load(true)
            } else {
              setKeyError((response && response.error && response.error.message) || t('unknown'))
            }
          })
          .catch((error) => {
            setKeyError(String((error && error.message) || error))
          })
          .finally(() => { setKeyBusy(false) })
      }

      const children = []
      if (state.status === 'failed') {
        children.push(React.createElement(NoticeCard, { key: 'failed', message: t('fetchFailed'), error: true }))
      } else if (state.status !== 'ready' || data === null) {
        children.push(React.createElement(NoticeCard, { key: 'loading', message: t('loading') }))
      } else if (data.error === 'no-key') {
        children.push(React.createElement(NoticeCard, { key: 'nokey', message: t('noKey'), error: true }))
      } else if (data.error) {
        children.push(React.createElement(NoticeCard, {
          key: 'error',
          message: errText(data.error) + (data.detail ? ' · ' + data.detail : ''),
          error: true,
        }))
      } else if (!data.balance) {
        children.push(React.createElement(NoticeCard, { key: 'nodata', message: t('noData') }))
      } else {
        children.push(React.createElement(CreditCard, { key: 'credit', balance: data.balance }))
        children.push(React.createElement(UsageCard, {
          key: 'usage',
          usage: data.usage,
          range: data.usageRange || (data.usage && data.usage.range) || '',
          error: data.usageError,
          detail: data.usageDetail,
        }))
        children.push(React.createElement(OffPeakCard, { key: 'offpeak' }))
        if (data.keyEnv) {
          children.push(React.createElement('div', { className: 'oq-card', key: 'keysource' },
            React.createElement('div', { className: 'oq-row' },
              React.createElement('span', { className: 'oq-sub' }, t('keyRefLabel')),
              React.createElement('span', { className: 'oq-sub oq-mono' }, data.keyEnv))))
        }
      }
      children.push(React.createElement(ApiKeyCard, {
        key: 'apikey',
        remoteAvailable: credentials !== undefined,
        primaryRef,
        primaryInfo,
        editable,
        draft,
        busy: keyBusy,
        error: keyError,
        message: keyMessage,
        describeError: keyState.error,
        onDraftChange: setDraft,
        onSave: saveKey,
        onClear: clearKey,
      }))
      children.push(React.createElement('div', { className: 'oq-foot', key: 'foot' },
        React.createElement('span', { className: 'oq-sub' }, t('updated') + ' ' + fmtTime(data && data.updatedAt)),
        React.createElement('button', {
          className: 'oq-btn',
          type: 'button',
          disabled: busy,
          onClick: () => load(true),
        }, busy ? t('refreshing') : t('refresh'))))

      return React.createElement('div', { className: 'oq-section' }, children)
    }

    /**
     * Register the Settings section and the plugin's dictionaries.
     * @param ctx - Client plugin context.
     */
    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return
      const locale = ctx.get('locale')
      if (locale !== undefined) {
        ctx.effect(() => locale.register(LOCALE_NS, 'ja', ja), 'ollama-quota: Japanese dictionary')
        ctx.effect(() => locale.register(LOCALE_NS, 'zh', zh), 'ollama-quota: Chinese dictionary')
        ctx.effect(() => locale.register(LOCALE_NS, 'en', en), 'ollama-quota: English dictionary')
        t = locale.bind(LOCALE_NS)
      }
      // `remote.credentials` is a declared inject edge: the Remote accessor
      // refuses the namespace property, and its methods are the current
      // positional form (describe(refs) / set(ref, value) / unset(ref)).
      credentials = ctx.remote.credentials
      ctx.effect(() => {
        sidebarStore.start()
        return () => { sidebarStore.stop() }
      }, 'ollama-quota: sidebar poller')
      // The sidebar foot area stacks actions above the Settings entry, which is
      // where the always-visible quota widget belongs.
      slots.inject('sidebar.footer.action', () => slots.register({
        name: 'sidebar.footer.action',
        id: 'ollama-quota',
        order: 10,
        label: () => t('nav'),
      }, SidebarQuota))
      slots.inject('settings.section', () => slots.register({
        name: 'settings.section',
        id: 'ollama-quota',
        order: -9,
        label: () => t('nav'),
      }, OllamaQuotaSection))
    }

    exports.apply = apply
    exports.inject = ['slots', 'remote', 'remote.credentials']
    return module.exports
  },
})
