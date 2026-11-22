export const bodyAreas = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs & Glutes', 'Core', 'Full Body', 'Cardio', 'Mobility & Stretching']
export const equipmentOptions = ['Bodyweight', 'Dumbbell', 'Band', 'Bar', 'Kettlebell', 'Barbell', 'Machine']
export const levels = ['Beginner', 'Intermediate', 'Advanced']
export const movements = ['Push', 'Pull', 'Squat', 'Hinge', 'Carry', 'Core', 'Cardio']
export type Exercise = {
  id: string; name: string; slug: string; body_area: string; movement_type: string
  equipment: string[]; level: string; primary_muscles: string[]; secondary_muscles: string[]
  instructions: string[]; image_paths: string[]; is_active: boolean; legacy_names: string[]
}

export function filterExercises(rows: Exercise[], params: URLSearchParams, favorites: Set<string>) {
  const query = (params.get('q') ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  const equipment = params.getAll('equipment')
  const area = params.get('area')
  const level = params.get('level')
  const movement = params.get('movement')
  return rows.filter((row) => {
    const searchable = [row.name, ...row.legacy_names, ...row.primary_muscles, ...row.secondary_muscles].join(' ').toLowerCase()
    return row.is_active && query.every((word) => searchable.includes(word))
      && (!area || row.body_area === area) && (!level || row.level === level)
      && (!movement || row.movement_type === movement)
      && (!equipment.length || equipment.some((item) => row.equipment.includes(item)))
      && (params.get('tab') !== 'favorites' || favorites.has(row.id))
  })
}
