import { m } from '#/paraglide/messages.js'

type Locale = 'en' | 'da'

const messages: Record<
  string,
  (inputs: object, options: { locale: Locale }) => string
> = {
  person: m.label_person,
  car: m.label_car,
  dog: m.label_dog,
  cat: m.label_cat,
  bird: m.label_bird,
  bicycle: m.label_bicycle,
  motorcycle: m.label_motorcycle,
  bus: m.label_bus,
  truck: m.label_truck,
  boat: m.label_boat,
  horse: m.label_horse,
  package: m.label_package,
  face: m.label_face,
  license_plate: m.label_license_plate,
}

/** Translate a Frigate label; unknown labels are humanised (underscores to spaces, capitalised). */
export function translateLabel(label: string, locale: Locale): string {
  if (Object.hasOwn(messages, label)) return messages[label]({}, { locale })
  const text = label.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
