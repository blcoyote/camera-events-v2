import { describe, it, expect } from 'vitest'
import { parseFrigateReview, ReviewAlertGate } from './review-alert'
import type { FrigateReviewMessage } from './review-alert'

interface PayloadOverrides {
  type?: unknown
  after?: unknown
  id?: unknown
  camera?: unknown
  severity?: unknown
  data?: unknown
}

function makeReviewPayload(overrides: PayloadOverrides = {}): Buffer {
  const after =
    'after' in overrides
      ? overrides.after
      : {
          id: 'id' in overrides ? overrides.id : '1718987129.308396-fqk5ka',
          camera: 'camera' in overrides ? overrides.camera : 'front_cam',
          start_time: 1718987129.308396,
          end_time: null,
          severity: 'severity' in overrides ? overrides.severity : 'alert',
          data:
            'data' in overrides
              ? overrides.data
              : {
                  detections: [
                    '1718987128.947436-g92ztx',
                    '1718987148.879516-d7oq7r',
                  ],
                  objects: ['person', 'car'],
                  sub_labels: [],
                  zones: [],
                  audio: [],
                },
        }
  return Buffer.from(
    JSON.stringify({
      type: 'type' in overrides ? overrides.type : 'new',
      before: {},
      after,
    }),
  )
}

function makeMsg(
  overrides: Partial<FrigateReviewMessage> = {},
): FrigateReviewMessage {
  return {
    type: 'new',
    reviewId: 'r1',
    camera: 'front_cam',
    severity: 'alert',
    detections: ['d1'],
    ...overrides,
  }
}

describe('parseFrigateReview', () => {
  it('parses a well-formed payload', () => {
    expect(parseFrigateReview(makeReviewPayload())).toEqual({
      type: 'new',
      reviewId: '1718987129.308396-fqk5ka',
      camera: 'front_cam',
      severity: 'alert',
      detections: ['1718987128.947436-g92ztx', '1718987148.879516-d7oq7r'],
    })
  })

  it.each(['new', 'update', 'end'] as const)('accepts type %s', (type) => {
    expect(parseFrigateReview(makeReviewPayload({ type }))?.type).toBe(type)
  })

  it('accepts detection severity', () => {
    expect(
      parseFrigateReview(makeReviewPayload({ severity: 'detection' }))
        ?.severity,
    ).toBe('detection')
  })

  describe('malformed input', () => {
    it('returns null for non-JSON', () => {
      expect(parseFrigateReview(Buffer.from('not json{'))).toBeNull()
    })

    it('returns null for JSON that is not an object', () => {
      expect(parseFrigateReview(Buffer.from('null'))).toBeNull()
      expect(parseFrigateReview(Buffer.from('42'))).toBeNull()
    })

    it('returns null for an unknown type', () => {
      expect(
        parseFrigateReview(makeReviewPayload({ type: 'bogus' })),
      ).toBeNull()
    })

    it('returns null for a missing type', () => {
      expect(
        parseFrigateReview(makeReviewPayload({ type: undefined })),
      ).toBeNull()
    })

    it('returns null when after is missing', () => {
      expect(
        parseFrigateReview(makeReviewPayload({ after: undefined })),
      ).toBeNull()
    })

    it('returns null when after is not an object', () => {
      expect(parseFrigateReview(makeReviewPayload({ after: 'x' }))).toBeNull()
      expect(parseFrigateReview(makeReviewPayload({ after: null }))).toBeNull()
    })

    it('returns null for a numeric id', () => {
      expect(parseFrigateReview(makeReviewPayload({ id: 123 }))).toBeNull()
    })

    it('returns null for a non-string camera', () => {
      expect(parseFrigateReview(makeReviewPayload({ camera: 5 }))).toBeNull()
    })

    it('returns null for an unknown severity', () => {
      expect(
        parseFrigateReview(makeReviewPayload({ severity: 'critical' })),
      ).toBeNull()
    })
  })

  describe('detections', () => {
    it('treats missing data as an empty list', () => {
      expect(
        parseFrigateReview(makeReviewPayload({ data: undefined }))?.detections,
      ).toEqual([])
    })

    it('treats missing detections as an empty list', () => {
      expect(
        parseFrigateReview(makeReviewPayload({ data: {} }))?.detections,
      ).toEqual([])
    })

    it('treats non-array detections as an empty list', () => {
      expect(
        parseFrigateReview(makeReviewPayload({ data: { detections: 'abc' } }))
          ?.detections,
      ).toEqual([])
    })

    it('keeps only string entries of a mixed-type array', () => {
      expect(
        parseFrigateReview(
          makeReviewPayload({
            data: { detections: ['a', 1, null, 'b', {}, 'c'] },
          }),
        )?.detections,
      ).toEqual(['a', 'b', 'c'])
    })
  })
})

describe('ReviewAlertGate', () => {
  it('notifies the first alert on a new message', () => {
    const gate = new ReviewAlertGate()
    expect(gate.consider(makeMsg())).toBe('notify')
  })

  it('skips detection-severity messages', () => {
    const gate = new ReviewAlertGate()
    expect(gate.consider(makeMsg({ severity: 'detection' }))).toBe('skip')
    expect(
      gate.consider(makeMsg({ severity: 'detection', type: 'update' })),
    ).toBe('skip')
  })

  it('notifies once when a detection is upgraded to alert', () => {
    const gate = new ReviewAlertGate()
    expect(gate.consider(makeMsg({ severity: 'detection' }))).toBe('skip')
    expect(gate.consider(makeMsg({ type: 'update' }))).toBe('notify')
    expect(gate.consider(makeMsg({ type: 'update' }))).toBe('skip')
  })

  it('skips repeated alert updates', () => {
    const gate = new ReviewAlertGate()
    expect(gate.consider(makeMsg())).toBe('notify')
    expect(gate.consider(makeMsg({ type: 'update' }))).toBe('skip')
    expect(gate.consider(makeMsg({ type: 'update' }))).toBe('skip')
  })

  it('tracks review ids independently', () => {
    const gate = new ReviewAlertGate()
    expect(gate.consider(makeMsg({ reviewId: 'a' }))).toBe('notify')
    expect(gate.consider(makeMsg({ reviewId: 'b' }))).toBe('notify')
  })

  it('always skips end messages', () => {
    const gate = new ReviewAlertGate()
    expect(gate.consider(makeMsg({ type: 'end' }))).toBe('skip')
  })

  it('skips end for an untracked id without error', () => {
    const gate = new ReviewAlertGate()
    expect(() =>
      gate.consider(makeMsg({ type: 'end', reviewId: 'never-seen' })),
    ).not.toThrow()
  })

  it('notifies again for a new alert with the same id after end', () => {
    const gate = new ReviewAlertGate()
    expect(gate.consider(makeMsg())).toBe('notify')
    expect(gate.consider(makeMsg({ type: 'end' }))).toBe('skip')
    expect(gate.consider(makeMsg())).toBe('notify')
  })

  it('notifies again after release', () => {
    const gate = new ReviewAlertGate()
    expect(gate.consider(makeMsg())).toBe('notify')
    gate.release('r1')
    expect(gate.consider(makeMsg({ type: 'update' }))).toBe('notify')
  })

  it('release of an untracked id is a no-op', () => {
    const gate = new ReviewAlertGate()
    expect(() => gate.release('nope')).not.toThrow()
  })

  it('evicts the oldest tracked id when over maxTracked', () => {
    const gate = new ReviewAlertGate(2)
    expect(gate.consider(makeMsg({ reviewId: 'a' }))).toBe('notify')
    expect(gate.consider(makeMsg({ reviewId: 'b' }))).toBe('notify')
    expect(gate.consider(makeMsg({ reviewId: 'c' }))).toBe('notify')
    expect(gate.consider(makeMsg({ reviewId: 'c', type: 'update' }))).toBe(
      'skip',
    )
    expect(gate.consider(makeMsg({ reviewId: 'a', type: 'update' }))).toBe(
      'notify',
    )
  })

  describe('detectionsFor', () => {
    it('returns the detections of a tracked review', () => {
      const gate = new ReviewAlertGate()
      gate.consider(makeMsg({ detections: ['d1', 'd2'] }))
      expect(gate.detectionsFor('r1')).toEqual(['d1', 'd2'])
    })

    it('returns undefined for an untracked review', () => {
      const gate = new ReviewAlertGate()
      expect(gate.detectionsFor('nope')).toBeUndefined()
    })

    it('merges new detections from an alert update and still skips', () => {
      const gate = new ReviewAlertGate()
      gate.consider(makeMsg({ detections: ['d1'] }))
      expect(
        gate.consider(makeMsg({ type: 'update', detections: ['d1', 'd2'] })),
      ).toBe('skip')
      expect(gate.detectionsFor('r1')).toEqual(['d1', 'd2'])
    })

    it('keeps existing ids first and appends new ones in order', () => {
      const gate = new ReviewAlertGate()
      gate.consider(makeMsg({ detections: ['d1', 'd2'] }))
      gate.consider(makeMsg({ type: 'update', detections: ['d3', 'd2', 'd4'] }))
      expect(gate.detectionsFor('r1')).toEqual(['d1', 'd2', 'd3', 'd4'])
    })

    it('does not duplicate ids', () => {
      const gate = new ReviewAlertGate()
      gate.consider(makeMsg({ detections: ['d1'] }))
      gate.consider(makeMsg({ type: 'update', detections: ['d1', 'd1'] }))
      expect(gate.detectionsFor('r1')).toEqual(['d1'])
    })

    it('merges detections from a detection-severity update of a tracked review', () => {
      const gate = new ReviewAlertGate()
      gate.consider(makeMsg({ detections: ['d1'] }))
      expect(
        gate.consider(
          makeMsg({
            type: 'update',
            severity: 'detection',
            detections: ['d1', 'd9'],
          }),
        ),
      ).toBe('skip')
      expect(gate.detectionsFor('r1')).toEqual(['d1', 'd9'])
    })

    it('does not track an untracked detection-severity review', () => {
      const gate = new ReviewAlertGate()
      gate.consider(makeMsg({ severity: 'detection' }))
      expect(gate.detectionsFor('r1')).toBeUndefined()
    })

    it('returns a copy that callers cannot use to mutate the gate', () => {
      const gate = new ReviewAlertGate()
      gate.consider(makeMsg({ detections: ['d1'] }))
      gate.detectionsFor('r1')?.push('evil')
      expect(gate.detectionsFor('r1')).toEqual(['d1'])
    })

    it('does not alias the message detections array', () => {
      const gate = new ReviewAlertGate()
      const detections = ['d1']
      gate.consider(makeMsg({ detections }))
      detections.push('late')
      expect(gate.detectionsFor('r1')).toEqual(['d1'])
    })

    it('is undefined after end', () => {
      const gate = new ReviewAlertGate()
      gate.consider(makeMsg())
      gate.consider(makeMsg({ type: 'end' }))
      expect(gate.detectionsFor('r1')).toBeUndefined()
    })

    it('is undefined after release', () => {
      const gate = new ReviewAlertGate()
      gate.consider(makeMsg())
      gate.release('r1')
      expect(gate.detectionsFor('r1')).toBeUndefined()
    })

    it('merging does not refresh eviction order', () => {
      const gate = new ReviewAlertGate(2)
      gate.consider(makeMsg({ reviewId: 'a' }))
      gate.consider(makeMsg({ reviewId: 'b' }))
      // merge into the oldest entry; it must stay oldest
      gate.consider(
        makeMsg({ reviewId: 'a', type: 'update', detections: ['d1', 'd2'] }),
      )
      gate.consider(makeMsg({ reviewId: 'c' }))
      expect(gate.detectionsFor('a')).toBeUndefined()
      expect(gate.detectionsFor('b')).toEqual(['d1'])
      expect(gate.detectionsFor('c')).toEqual(['d1'])
    })
  })
})
