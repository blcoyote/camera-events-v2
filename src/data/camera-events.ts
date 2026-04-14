export interface CameraEvent {
  id: string
  title: string
  timestamp: string
  camera: string
}

export const PLACEHOLDER_EVENTS: CameraEvent[] = [
  {
    id: 'evt-001',
    title: 'Motion detected — front porch',
    timestamp: '2026-04-14T08:23:00Z',
    camera: 'Front Porch',
  },
  {
    id: 'evt-002',
    title: 'Person detected — driveway',
    timestamp: '2026-04-14T07:45:00Z',
    camera: 'Driveway',
  },
  {
    id: 'evt-003',
    title: 'Package delivered — front door',
    timestamp: '2026-04-13T14:12:00Z',
    camera: 'Front Door',
  },
  {
    id: 'evt-004',
    title: 'Motion detected — backyard',
    timestamp: '2026-04-13T22:05:00Z',
    camera: 'Backyard',
  },
  {
    id: 'evt-005',
    title: 'Vehicle detected — garage',
    timestamp: '2026-04-12T17:30:00Z',
    camera: 'Garage',
  },
]

export function findEventById(id: string): CameraEvent | undefined {
  return PLACEHOLDER_EVENTS.find((event) => event.id === id)
}
