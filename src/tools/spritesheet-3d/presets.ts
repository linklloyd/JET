export interface CameraPreset {
  name: string
  description: string
  elevation: number // degrees
  angles: number[] // degrees around Y axis
  useOrthographic: boolean
}

export const presets: Record<string, CameraPreset> = {
  rpg8: {
    name: 'RPG / Top-down (8 dirs)',
    description: '8 directional captures from a top-down angle',
    elevation: 55,
    angles: [0, 45, 90, 135, 180, 225, 270, 315],
    useOrthographic: false,
  },
  rpg4: {
    name: 'RPG / Top-down (4 dirs)',
    description: '4 directional captures (N/E/S/W)',
    elevation: 55,
    angles: [0, 90, 180, 270],
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
    name: 'Custom (8 dirs)',
    description: 'All 8 directions with adjustable elevation',
    elevation: 45,
    angles: [0, 45, 90, 135, 180, 225, 270, 315],
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
