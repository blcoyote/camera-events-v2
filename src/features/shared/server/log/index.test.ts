import { SpanStatusCode, context } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace'
import type { MockInstance } from 'vitest'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('@tanstack/react-start/server-only', () => ({}))

async function load(level?: string) {
  vi.resetModules()
  vi.stubEnv('LOG_LEVEL', level ?? '')
  return (await import('.')).log
}

let spy: MockInstance<typeof console.log>

function lines() {
  return spy.mock.calls.map(
    ([l]) => JSON.parse(l as string) as Record<string, string>,
  )
}

beforeEach(() => {
  spy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  spy.mockRestore()
  vi.unstubAllEnvs()
})

describe('log', () => {
  it('writes one JSON line with ordered time, level, component, msg, fields', async () => {
    const log = await load()
    log.info('mqtt', 'hello', { a: 1 })
    expect(spy).toHaveBeenCalledTimes(1)
    const line = lines()[0]
    expect(Object.keys(line)).toEqual([
      'time',
      'level',
      'component',
      'msg',
      'a',
    ])
    expect(new Date(line.time).toISOString()).toBe(line.time)
    expect(line).toMatchObject({
      level: 'info',
      component: 'mqtt',
      msg: 'hello',
      a: 1,
    })
  })

  it('never throws on unserialisable fields and still logs the message', async () => {
    const log = await load()
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() =>
      log.error('mqtt', 'boom', new Error('x'), { circular, n: 1n }),
    ).not.toThrow()
    expect(lines()[0]).toMatchObject({
      level: 'error',
      msg: 'boom',
      log_error: expect.any(String),
    })
    expect(lines()[0]).toHaveProperty('err.message', 'x')
  })

  it('ignores a toJSON field so it cannot replace the line', async () => {
    const log = await load()
    log.info('c', 'm', { toJSON: () => ({ level: 'forged' }) })
    expect(lines()[0]).toMatchObject({
      level: 'info',
      component: 'c',
      msg: 'm',
    })
  })

  it('never throws on a field with a throwing getter', async () => {
    const log = await load()
    const fields = {
      get bad(): never {
        throw new Error('getter')
      },
    }
    expect(() => log.info('c', 'm', fields)).not.toThrow()
    expect(lines()[0]).toMatchObject({ level: 'info', msg: 'm' })
  })

  it('never throws on a prototype-less error', async () => {
    const log = await load()
    expect(() => log.error('c', 'm', Object.create(null))).not.toThrow()
    expect(lines()[0]).toMatchObject({ level: 'error', msg: 'm' })
  })

  it('does not let fields overwrite reserved keys', async () => {
    const log = await load()
    log.warn('c', 'm', {
      time: 'x',
      level: 'x',
      component: 'x',
      msg: 'x',
      trace_id: 'x',
      span_id: 'x',
      err: 'x',
      ok: 1,
    })
    const line = lines()[0]
    expect(line).toMatchObject({
      level: 'warn',
      component: 'c',
      msg: 'm',
      ok: 1,
    })
    expect(line.time).not.toBe('x')
    expect(line.trace_id).toBeUndefined()
    expect(line.span_id).toBeUndefined()
    expect(line.err).toBeUndefined()
  })

  describe('LOG_LEVEL', () => {
    it('defaults to info when unset', async () => {
      const log = await load()
      log.debug('c', 'd')
      log.info('c', 'i')
      expect(lines().map((l) => l.msg)).toEqual(['i'])
    })

    it('defaults to info when unknown', async () => {
      const log = await load('verbose')
      log.debug('c', 'd')
      log.info('c', 'i')
      expect(lines().map((l) => l.msg)).toEqual(['i'])
    })

    it('debug lets everything through', async () => {
      const log = await load('debug')
      log.debug('c', 'd')
      expect(lines()).toHaveLength(1)
    })

    it('warn drops info', async () => {
      const log = await load('warn')
      log.info('c', 'i')
      log.warn('c', 'w')
      log.error('c', 'e')
      expect(lines().map((l) => l.msg)).toEqual(['w', 'e'])
    })

    it('error drops warn', async () => {
      const log = await load('error')
      log.warn('c', 'w')
      log.error('c', 'e')
      expect(lines().map((l) => l.msg)).toEqual(['e'])
    })
  })

  describe('error', () => {
    it('serialises an Error as name, message, stack', async () => {
      const log = await load()
      const err = new TypeError('boom')
      log.error('c', 'failed', err, { x: 1 })
      const line = lines()[0]
      expect(line.err).toEqual({
        name: 'TypeError',
        message: 'boom',
        stack: err.stack,
      })
      expect(Object.keys(line)).toEqual([
        'time',
        'level',
        'component',
        'msg',
        'err',
        'x',
      ])
    })

    it('serialises a non-Error as message', async () => {
      const log = await load()
      log.error('c', 'failed', 42)
      expect(lines()[0].err).toEqual({ message: '42' })
    })

    it('omits err when undefined', async () => {
      const log = await load()
      log.error('c', 'failed')
      expect('err' in lines()[0]).toBe(false)
    })
  })

  describe('with a span', () => {
    const exporter = new InMemorySpanExporter()
    const provider = new TracerProvider({
      spanProcessors: [new SimpleSpanProcessor({ exporter })],
    })
    const tracer = provider.getTracer('test')

    beforeAll(() => {
      context.setGlobalContextManager(
        new AsyncLocalStorageContextManager().enable(),
      )
    })
    afterAll(() => {
      context.disable()
    })
    afterEach(() => exporter.reset())

    it('adds trace_id and span_id after msg', async () => {
      const log = await load()
      tracer.startActiveSpan('s', (span) => {
        log.info('c', 'm', { a: 1 })
        const line = lines()[0]
        expect(line.trace_id).toBe(span.spanContext().traceId)
        expect(line.span_id).toBe(span.spanContext().spanId)
        expect(Object.keys(line)).toEqual([
          'time',
          'level',
          'component',
          'msg',
          'trace_id',
          'span_id',
          'a',
        ])
        span.end()
      })
    })

    it('keeps trace ids when fields cannot be serialised', async () => {
      const log = await load()
      tracer.startActiveSpan('s', (span) => {
        log.info('c', 'm', { count: 1n })
        expect(lines()[0]).toMatchObject({
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
          log_error: expect.any(String),
        })
        span.end()
      })
    })

    it('omits trace ids without an active span', async () => {
      const log = await load()
      log.info('c', 'm')
      expect('trace_id' in lines()[0]).toBe(false)
      expect('span_id' in lines()[0]).toBe(false)
    })

    it('log.error records the exception and sets ERROR status', async () => {
      const log = await load()
      tracer.startActiveSpan('s', (span) => {
        log.error('c', 'bad', new Error('boom'))
        span.end()
      })
      await provider.forceFlush()
      const [done] = exporter.getFinishedSpans()
      expect(done.status.code).toBe(SpanStatusCode.ERROR)
      expect(done.status.message).toBe('bad')
      expect(done.events.map((e) => e.name)).toEqual(['exception'])
    })

    it('log.error with a prototype-less error still sets ERROR status', async () => {
      const log = await load()
      tracer.startActiveSpan('s', (span) => {
        expect(() => log.error('c', 'bad', Object.create(null))).not.toThrow()
        span.end()
      })
      await provider.forceFlush()
      const [done] = exporter.getFinishedSpans()
      expect(done.status.code).toBe(SpanStatusCode.ERROR)
    })

    it('log.error without err sets status but records no exception', async () => {
      const log = await load()
      tracer.startActiveSpan('s', (span) => {
        log.error('c', 'bad')
        span.end()
      })
      await provider.forceFlush()
      const [done] = exporter.getFinishedSpans()
      expect(done.status.code).toBe(SpanStatusCode.ERROR)
      expect(done.events).toHaveLength(0)
    })
  })
})
