import { describe, expect, it } from 'vitest'
import { filterExercises, type Exercise } from './exerciseFilters'

const base: Exercise = {
  id: 'row', slug: 'row', name: 'Dumbbell row', body_area: 'Back', movement_type: 'Pull',
  equipment: ['Dumbbell'], level: 'Beginner', primary_muscles: ['lats'],
  secondary_muscles: ['biceps'], legacy_names: ['Bent-over row'], instructions: [], image_paths: [],
  is_active: true,
}
const rows = [base, { ...base, id: 'press', name: 'Chest press', body_area: 'Chest', equipment: ['Machine'], movement_type: 'Push', level: 'Intermediate', primary_muscles: ['chest'], secondary_muscles: [], legacy_names: [] }, { ...base, id: 'inactive', is_active: false }]

describe('exercise library filters', () => {
  it('matches names, secondary muscles, and legacy aliases case-insensitively', () => {
    expect(filterExercises(rows, new URLSearchParams({ q: ' BENT-over BICEPS ' }), new Set())).toEqual([base])
  })

  it('combines body area, level and movement with any selected equipment', () => {
    const params = new URLSearchParams('area=Back&level=Beginner&movement=Pull&equipment=Band&equipment=Dumbbell')
    expect(filterExercises(rows, params, new Set())).toEqual([base])
    params.set('movement', 'Push')
    expect(filterExercises(rows, params, new Set())).toEqual([])
  })

  it('shows only active favorites in the favorites view', () => {
    expect(filterExercises(rows, new URLSearchParams('tab=favorites'), new Set(['press', 'inactive'])).map((row) => row.id)).toEqual(['press'])
  })
})
