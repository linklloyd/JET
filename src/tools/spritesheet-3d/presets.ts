export interface CameraPreset {
  name: string
  description: string
  elevation: number // degrees
  angles: number[] // degrees around Y axis
  useOrthographic: boolean
}

export const ANGLES_8 = [0, 45, 90, 135, 180, 225, 270, 315]
export const ANGLES_4 = [0, 90, 180, 270]

export const presets: Record<string, CameraPreset> = {
  rpg8: {
    name: 'RPG / Top-down (8 dirs)',
    description: '8 directional captures from a top-down angle',
    elevation: 55,
    angles: ANGLES_8,
    useOrthographic: false,
  },
  rpg4: {
    name: 'RPG / Top-down (4 dirs)',
    description: '4 directional captures (N/E/S/W)',
    elevation: 55,
    angles: ANGLES_4,
    useOrthographic: false,
  },
  platformer: {
    name: 'Platformer (Side view)',
    description: 'Side view captures (left and right)',
    elevation: 0,
    angles: [90, 270],
    useOrthographic: false,
  },
  isometric: {
    name: 'Isometric',
    description: 'Isometric camera with orthographic projection',
    elevation: 35.264, // arctan(1/sqrt(2))
    angles: [45, 135, 225, 315],
    useOrthographic: true,
  },
  custom: {
    name: 'Custom',
    description: 'Custom directions with adjustable elevation',
    elevation: 45,
    angles: ANGLES_8,
    useOrthographic: false,
  },
}

export const directionLabels: Record<number, string> = {
  0: 'N',
  45: 'NE',
  90: 'E',
  135: 'SE',
  180: 'S',
  225: 'SW',
  270: 'W',
  315: 'NW',
}

// --- Saved custom presets (localStorage) ---

const STORAGE_KEY = 'jet-3d-custom-presets'

export interface SavedCustomPreset {
  name: string
  elevation: number
  directionCount: 4 | 8
  frameCount: number
  captureSize: number
  cameraDistance: number
  bgColor: 'transparent' | 'green' | 'blue'
}

export function loadSavedPresets(): SavedCustomPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function savePreset(preset: SavedCustomPreset): SavedCustomPreset[] {
  const existing = loadSavedPresets()
  // Replace if same name exists
  const idx = existing.findIndex((p) => p.name === preset.name)
  if (idx >= 0) existing[idx] = preset
  else existing.push(preset)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  return existing
}

export function deletePreset(name: string): SavedCustomPreset[] {
  const existing = loadSavedPresets().filter((p) => p.name !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  return existing
}
