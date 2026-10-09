# dsh-ollama-quota

DeepSeek Harness plugin that shows the **Ollama Cloud credit balance** as a Settings section
(id `ollama-quota`, order `-9`, directly below the shipped Account entry) and lets you enter
or replace the Ollama Cloud API key on that same page.

Ollama moved the account to a credit model: `GET https://ollama.com/api/usage` no longer
carries the old `limits.session` / `limits.weekly` windows (it answers a
`range`/`totals`/`buckets` report instead), so readers built on that shape fail with
**"Could not parse the response · no limits object"**. The remaining credit now comes from
`GET https://ollama.com/api/balance`, which is what this plugin reads.

## Data sources

| Endpoint | Role |
| --- | --- |
| `GET https://ollama.com/api/balance` | primary: `included.balance_usd`, `included.allowance_usd`, `included.period`, `purchased.balance_usd` |
| `GET https://ollama.com/api/usage?range=24h\|7d\|30d` | advisory: `totals` (cost, requests, tokens) and daily `buckets` |

Both take `Authorization: Bearer <Ollama Cloud key>`. A failure on the usage report never
hides a healthy balance; it renders as an inline note inside the usage card. The usage report
is re-read on its own slower interval (`usageRefreshMs`) because its wide window barely moves.

## What it shows

| Row | Source |
| --- | --- |
| Remaining included credit | `included.balance_usd` of `included.allowance_usd` |
| Used share bar | `allowance - balance` over `allowance` |
| Purchased credit | `purchased.balance_usd` |
| Allowance period | `included.period.from` → `included.period.until` |
| Spend, requests, input/cached/output tokens | `usage.totals` over `usageRange` |
| Daily spend strip | `usage.buckets[].usage_usd` (max 31 buckets) |
| Off-peak state and countdown | computed from the browser clock: peak pricing runs weekdays 12:00–18:00 UTC, everything else is off-peak |
| Key source | which credential reference resolved |
| API key editor | `remote.credentials.describe(refs)` / `set(ref, value)` / `unset(ref)` over the DSH Remote (`remote.credentials` is a declared inject edge) |

Per-model request counts are not shown: the endpoint stopped reporting them.

### Sidebar widget

The plugin also registers `sidebar.footer.action`, the list slot that stacks above the shipped
Settings entry. That widget is visible at all times, not only while Settings is open, and shows:

- remaining credit and the 30-day spend,
- whether off-peak pricing applies right now, with the current local time,
- the countdown to the next boundary at minute granularity (off-peak start while peak, off-peak
  end while off-peak),
- a progress meter for the running period and a 24h strip on the **browser's local clock** with
  the peak window charted onto it. JST turns 12:00–18:00 UTC into 21:00–03:00, so the band splits
  across local midnight; the ticks are local hours and the strip caption is the local time.

The collapsed 56px rail keeps the credit and a compact `H:MM` countdown.

Ollama applies off-peak pricing outside 12:00–18:00 UTC on weekdays and all day at weekends, so
the peak window is the only interval whose end is a peak start.

The Settings section carries the same state as an additional card with the full rule text, the
local peak window, the current local time, and both countdowns.

## Install

```sh
dsh plugin --profile web add git+https://github.com/okku000/dsh-ollama-quota.git
```

While developing against a checkout, link the directory instead so edits are live:

```sh
dsh plugin --profile web add link:/path/to/dsh-ollama-quota
```

A Host change needs an application restart; the Client half needs a page refresh.

## Configuration

The row reads these fields, all optional (`cordis.patch.yml`):

| Field | Default | Meaning |
| --- | --- | --- |
| `keyEnvs` | `[OLLAMA_CLOUD_API_KEY, OLLAMA_API_KEY]` | credential references tried in order; the first is what the editor writes |
| `apiBase` | `https://ollama.com` | API origin |
| `usageRange` | `30d` | usage window, one of `24h`, `7d`, `30d` |
| `refreshMs` | `60000` | balance refresh interval, minimum `5000` |
| `usageRefreshMs` | `300000` | usage-report interval, minimum `60000`; `?force=1` or a new key re-reads it |
| `timeoutMs` | `15000` | per-request timeout |

The Host half serves `GET /ollama-quota/snapshot` (add `?force=1` to refresh first). The
snapshot carries dollar amounts, counts, timestamps, error labels, and the credential
reference order — never the key.

## Verify

```sh
node scripts/verify.mjs          # offline: fake Host context and fake browser runtime
node scripts/verify.mjs --live   # also drives the real endpoints with the stored key
```

`--live` reads `OLLAMA_CLOUD_API_KEY` from `$DSH_HOME/.credentials.yaml`.

## License

MIT — see [LICENSE](LICENSE).
