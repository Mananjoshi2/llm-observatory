/**
 * LLM Observatory — TypeScript/JS SDK
 *
 * Usage:
 *   import { Observatory } from './observatory'
 *
 *   const obs = new Observatory({ project: 'my-app' })
 *
 *   const result = await obs.trace({
 *     model: 'gpt-4o',
 *     fn: async (span) => {
 *       const res = await openai.chat.completions.create({ ... })
 *       span.record({ promptTokens: res.usage.prompt_tokens,
 *                     completionTokens: res.usage.completion_tokens })
 *       return res
 *     }
 *   })
 */

const PRICING: Record<string, [number, number]> = {
  'gpt-4o':              [2.50,  10.00],
  'gpt-4o-mini':         [0.15,   0.60],
  'gpt-4-turbo':         [10.0,  30.00],
  'gpt-3.5-turbo':       [0.50,   1.50],
  'claude-opus-4-6':     [15.0,  75.00],
  'claude-sonnet-4-6':   [3.00,  15.00],
  'claude-haiku-4-5':    [0.25,   1.25],
  'gemini-1.5-pro':      [3.50,   7.00],
  'gemini-1.5-flash':    [0.075,  0.30],
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const [rIn, rOut] = PRICING[model] ?? [1.0, 1.0]
  return (promptTokens * rIn + completionTokens * rOut) / 1_000_000
}

export interface SpanHandle {
  record(opts: { promptTokens?: number; completionTokens?: number; tags?: string[] }): void
  fail(error: string): void
}

interface TraceOpts<T> {
  model: string
  provider?: string
  project?: string
  fn: (span: SpanHandle) => Promise<T>
}

interface ObsOptions {
  project?: string
  host?: string
  silent?: boolean
}

export class Observatory {
  private project: string
  private host: string
  private silent: boolean

  constructor(opts: ObsOptions = {}) {
    this.project  = opts.project ?? 'default'
    this.host     = (opts.host ?? 'http://localhost:8000').replace(/\/$/, '')
    this.silent   = opts.silent ?? true
  }

  private async send(payload: Record<string, unknown>): Promise<void> {
    try {
      await fetch(`${this.host}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      if (!this.silent) console.warn('[observatory] warn:', e)
    }
  }

  async trace<T>({ model, provider = 'openai', project, fn }: TraceOpts<T>): Promise<T> {
    const start = Date.now()
    let promptTokens = 0
    let completionTokens = 0
    let status = 'success'
    let error: string | undefined
    let tags: string[] | undefined

    const span: SpanHandle = {
      record({ promptTokens: pt = 0, completionTokens: ct = 0, tags: t }) {
        promptTokens    = pt
        completionTokens = ct
        tags            = t
      },
      fail(msg: string) {
        status = 'error'
        error  = msg
      },
    }

    let result: T
    try {
      result = await fn(span)
    } catch (e: unknown) {
      span.fail(e instanceof Error ? e.message : String(e))
      throw e
    } finally {
      const latencyMs = Date.now() - start
      const costUsd   = estimateCost(model, promptTokens, completionTokens)
      await this.send({
        project:           project ?? this.project,
        model,
        provider,
        prompt_tokens:     promptTokens,
        completion_tokens: completionTokens,
        latency_ms:        latencyMs,
        cost_usd:          costUsd,
        status,
        error,
        tags,
      })
    }
    return result!
  }
}
