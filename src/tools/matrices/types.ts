export type Matrix = number[][]

export interface Step {
  label: string
  matrix?: Matrix
  description: string
  separatorCol?: number
}

export interface OperationResult {
  result: Matrix
  steps: Step[]
  verification?: Matrix
  verificationSteps?: Step[]
  extra?: Record<string, unknown>
}

export interface SystemResult {
  solution: number[]
  steps: Step[]
  variables: string[]
  verification?: string[]
}

export type EchelonTarget = 'upper' | 'lower' | 'identity'
export type DeterminantMethod = 'sarrus' | 'row-expansion' | 'triangular'
export type InverseMethod = 'gauss-jordan' | 'cofactors'
export type SystemMethod = 'gaussian' | 'gauss-jordan' | 'montante'

export type OperationType =
  | 'multiplication'
  | 'echelon'
  | 'inverse'
  | 'determinant'
  | 'cofactors'
  | 'systems'
  | 'visualizer'
