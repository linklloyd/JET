export type IntegrationTechnique =
  | 'power-rule'
  | 'u-substitution'
  | 'by-parts'
  | 'partial-fractions'
  | 'trig-substitution'
  | 'trig-identity'
  | 'direct'
  | 'sum-rule'
  | 'constant-multiple'
  | 'exp-substitution'
  | 'log-pattern'

export type IntegralMethod =
  | 'indefinite'
  | 'definite'
  | 'by-parts'
  | 'substitution'
  | 'partial-fractions'

export interface IntegralStep {
  label: string       // e.g., "Identify technique"
  expression: string  // Math expression at this step
  description: string // Explanation of what happened
  value?: string      // Optional computed value
}

export interface IntegralResult {
  input: string
  variable: string
  technique: IntegrationTechnique
  antiderivative: string
  steps: IntegralStep[]
  definiteValue?: string
  bounds?: { lower: string; upper: string }
  verified: boolean
  error?: string
}
