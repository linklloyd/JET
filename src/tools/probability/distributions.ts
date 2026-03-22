// ─── Math helpers ───────────────────────────────────────────────────────

function factorial(n: number): number {
  if (n < 0) return NaN
  if (n <= 1) return 1
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  if (k > n - k) k = n - k
  let r = 1
  for (let i = 0; i < k; i++) {
    r = (r * (n - i)) / (i + 1)
  }
  return r
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface Step {
  label: string
  expression: string
  value: string
}

export interface TableRow {
  x: number
  px: number
  cumulative: number
}

export interface DistBaseResult {
  mean: number
  variance: number
  stdDev: number
  table: TableRow[]
  meanFormula: string
  varianceFormula: string
  stdDevFormula: string
}

export type Operator = '=' | '>' | '<' | '>=' | '<=' | '!='

export interface IncisoResult {
  probability: number
  matchingRows: TableRow[]
  steps: Step[]
  interpretation: string
}

// ─── Inciso evaluator (works with any table) ────────────────────────────

export function evaluateInciso(table: TableRow[], op: Operator, value: number): IncisoResult {
  const opLabel: Record<Operator, string> = {
    '=': '=', '>': '>', '<': '<', '>=': '≥', '<=': '≤', '!=': '≠',
  }
  const opFn: Record<Operator, (x: number) => boolean> = {
    '=': (x) => x === value,
    '>': (x) => x > value,
    '<': (x) => x < value,
    '>=': (x) => x >= value,
    '<=': (x) => x <= value,
    '!=': (x) => x !== value,
  }

  const filter = opFn[op]
  const matchingRows = table.filter((r) => filter(r.x))
  const probability = matchingRows.reduce((s, r) => s + r.px, 0)

  const xValues = matchingRows.map((r) => r.x)
  const pValues = matchingRows.map((r) => r.px.toFixed(4))

  const steps: Step[] = [
    { label: 'Condición', expression: `P(X ${opLabel[op]} ${value})`, value: '' },
    { label: 'Valores que cumplen', expression: xValues.length > 0 ? `x ∈ {${xValues.join(', ')}}` : 'Ninguno', value: '' },
  ]

  if (matchingRows.length > 0 && matchingRows.length <= 15) {
    steps.push({
      label: 'Suma',
      expression: matchingRows.map((r) => `P(${r.x})`).join(' + '),
      value: '',
    })
    steps.push({
      label: '',
      expression: pValues.join(' + '),
      value: probability.toFixed(4),
    })
  } else if (matchingRows.length > 15) {
    if (op === '<=') {
      steps.push({ label: 'Acumulada', expression: `F(${value})`, value: probability.toFixed(4) })
    } else if (op === '<') {
      steps.push({ label: 'Acumulada', expression: `F(${value - 1})`, value: probability.toFixed(4) })
    } else if (op === '>=') {
      steps.push({ label: 'Complemento', expression: `1 − F(${value - 1})`, value: probability.toFixed(4) })
    } else if (op === '>') {
      steps.push({ label: 'Complemento', expression: `1 − F(${value})`, value: probability.toFixed(4) })
    } else {
      steps.push({ label: 'Total', expression: `Σ P(xᵢ) para x ${opLabel[op]} ${value}`, value: probability.toFixed(4) })
    }
  }

  steps.push({ label: 'Resultado', expression: `P(X ${opLabel[op]} ${value})`, value: probability.toFixed(4) })

  return {
    probability,
    matchingRows,
    steps,
    interpretation: `P(X ${opLabel[op]} ${value}) = ${probability.toFixed(4)} (${(probability * 100).toFixed(2)}%)`,
  }
}

// ─── Range inciso evaluator ─────────────────────────────────────────────

export type RangeOp = '<' | '<='

export function evaluateIncisoRange(
  table: TableRow[],
  low: number,
  opLow: RangeOp,
  opHigh: RangeOp,
  high: number,
): IncisoResult {
  const lowFn: Record<RangeOp, (x: number) => boolean> = {
    '<': (x) => x > low,
    '<=': (x) => x >= low,
  }
  const highFn: Record<RangeOp, (x: number) => boolean> = {
    '<': (x) => x < high,
    '<=': (x) => x <= high,
  }
  const opLowLabel = opLow === '<' ? '<' : '≤'
  const opHighLabel = opHigh === '<' ? '<' : '≤'

  const matchingRows = table.filter((r) => lowFn[opLow](r.x) && highFn[opHigh](r.x))
  const probability = matchingRows.reduce((s, r) => s + r.px, 0)

  const xValues = matchingRows.map((r) => r.x)
  const pValues = matchingRows.map((r) => r.px.toFixed(4))

  const condExpr = `P(${low} ${opLowLabel} X ${opHighLabel} ${high})`

  const steps: Step[] = [
    { label: 'Condición', expression: condExpr, value: '' },
    { label: 'Valores que cumplen', expression: xValues.length > 0 ? `x ∈ {${xValues.join(', ')}}` : 'Ninguno', value: '' },
  ]

  if (matchingRows.length > 0 && matchingRows.length <= 15) {
    steps.push({
      label: 'Suma',
      expression: matchingRows.map((r) => `P(${r.x})`).join(' + '),
      value: '',
    })
    steps.push({
      label: '',
      expression: pValues.join(' + '),
      value: probability.toFixed(4),
    })
  } else if (matchingRows.length > 15) {
    steps.push({ label: 'Total', expression: `Σ P(xᵢ) para ${low} ${opLowLabel} x ${opHighLabel} ${high}`, value: probability.toFixed(4) })
  }

  steps.push({ label: 'Resultado', expression: condExpr, value: probability.toFixed(4) })

  return {
    probability,
    matchingRows,
    steps,
    interpretation: `${condExpr} = ${probability.toFixed(4)} (${(probability * 100).toFixed(2)}%)`,
  }
}

// ─── Binomial base ──────────────────────────────────────────────────────

export function binomialBase(n: number, p: number): DistBaseResult {
  const q = 1 - p
  const mean = n * p
  const variance = n * p * q
  const stdDev = Math.sqrt(variance)

  const table: TableRow[] = []
  let cum = 0
  for (let x = 0; x <= n; x++) {
    const px = comb(n, x) * Math.pow(p, x) * Math.pow(q, n - x)
    cum += px
    table.push({ x, px, cumulative: cum })
  }

  return {
    mean, variance, stdDev, table,
    meanFormula: `μ = n · p = ${n} · ${p}`,
    varianceFormula: `σ² = n · p · (1−p) = ${n} · ${p} · ${q.toFixed(4)}`,
    stdDevFormula: `σ = √(n · p · (1−p)) = √${(n * p * q).toFixed(4)}`,
  }
}

// ─── Poisson base ───────────────────────────────────────────────────────

export function poissonBase(lambda: number): DistBaseResult {
  const mean = lambda
  const variance = lambda
  const stdDev = Math.sqrt(lambda)

  const tableMax = Math.min(Math.ceil(lambda + 4 * stdDev + 1), 50)
  const table: TableRow[] = []
  let cum = 0
  for (let x = 0; x <= tableMax; x++) {
    const px = (Math.pow(lambda, x) * Math.exp(-lambda)) / factorial(x)
    cum += px
    table.push({ x, px, cumulative: cum })
  }

  return {
    mean, variance, stdDev, table,
    meanFormula: `μ = λ = ${lambda}`,
    varianceFormula: `σ² = λ = ${lambda}`,
    stdDevFormula: `σ = √λ = √${lambda}`,
  }
}

// ─── Hypergeometric base ────────────────────────────────────────────────

export function hypergeometricBase(N: number, K: number, n: number): DistBaseResult {
  const mean = (n * K) / N
  const variance = (n * K * (N - K) * (N - n)) / (N * N * (N - 1))
  const stdDev = Math.sqrt(variance)

  const kMax = Math.min(n, K)

  const table: TableRow[] = []
  let cum = 0
  for (let x = 0; x <= kMax; x++) {
    const px = (comb(K, x) * comb(N - K, n - x)) / comb(N, n)
    cum += px
    table.push({ x, px, cumulative: cum })
  }

  return {
    mean, variance, stdDev, table,
    meanFormula: `μ = n · K / N = ${n} · ${K} / ${N}`,
    varianceFormula: `σ² = n·K·(N−K)·(N−n) / (N²·(N−1))`,
    stdDevFormula: `σ = √σ² = √${variance.toFixed(4)}`,
  }
}

/** Returns both success (K) and failure (N-K) distributions */
export interface HyperDualResult {
  success: DistBaseResult
  failure: DistBaseResult
}

export function hypergeometricDual(N: number, K: number, n: number): HyperDualResult {
  return {
    success: hypergeometricBase(N, K, n),
    failure: hypergeometricBase(N, N - K, n),
  }
}

// ─── Custom discrete base ───────────────────────────────────────────────

export interface DiscreteEntry {
  value: number
  probability: number
}

export function customDiscreteBase(entries: DiscreteEntry[]): DistBaseResult {
  const total = entries.reduce((s, e) => s + e.probability, 0)
  const normalized = entries.map((e) => ({ ...e, probability: e.probability / total }))

  const mean = normalized.reduce((s, e) => s + e.value * e.probability, 0)
  const variance = normalized.reduce((s, e) => s + (e.value - mean) ** 2 * e.probability, 0)
  const stdDev = Math.sqrt(variance)

  const sorted = [...normalized].sort((a, b) => a.value - b.value)
  let cum = 0
  const table: TableRow[] = sorted.map((e) => {
    cum += e.probability
    return { x: e.value, px: e.probability, cumulative: cum }
  })

  return {
    mean, variance, stdDev, table,
    meanFormula: `μ = Σ xᵢ · P(xᵢ)`,
    varianceFormula: `σ² = Σ (xᵢ − μ)² · P(xᵢ)`,
    stdDevFormula: `σ = √σ² = √${variance.toFixed(4)}`,
  }
}


