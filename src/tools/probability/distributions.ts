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

/** Lanczos approximation for the gamma function */
function gammaLn(z: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - gammaLn(1 - z)
  }
  z -= 1
  let x = c[0]
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i)
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

function gamma(z: number): number {
  return Math.exp(gammaLn(z))
}

/** Regularized incomplete beta function I_x(a, b) via continued fraction */
function betaIncomplete(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  // Use symmetry if needed for convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaIncomplete(1 - x, b, a)
  }
  const lnBeta = gammaLn(a) + gammaLn(b) - gammaLn(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a
  // Lentz's continued fraction
  let f = 1, c = 1, d = 0
  for (let i = 0; i <= 200; i++) {
    const m = Math.floor(i / 2)
    let num: number
    if (i === 0) {
      num = 1
    } else if (i % 2 === 0) {
      num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m))
    } else {
      num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))
    }
    d = 1 + num * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    d = 1 / d
    c = 1 + num / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    f *= c * d
    if (Math.abs(c * d - 1) < 1e-10) break
  }
  return front * (f - 1)
}

/** Regularized incomplete gamma function P(a, x) */
function gammaIncomplete(a: number, x: number): number {
  if (x <= 0) return 0
  if (x < a + 1) {
    // Series expansion
    let sum = 1 / a, term = 1 / a
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < 1e-10 * Math.abs(sum)) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a))
  } else {
    // Continued fraction
    let f = 1, c = 1, d = 0
    for (let i = 1; i <= 200; i++) {
      const an = i % 2 === 1 ? Math.floor(i / 2) + 1 - a : Math.floor(i / 2)
      const num = i % 2 === 1 ? -(an - a) * 1 : an
      const den = x - a + i
      d = den + num * d
      if (Math.abs(d) < 1e-30) d = 1e-30
      d = 1 / d
      c = den + num / c
      if (Math.abs(c) < 1e-30) c = 1e-30
      f *= c * d
      if (Math.abs(c * d - 1) < 1e-10) break
    }
    // This gives Q(a,x) = 1 - P(a,x), so:
    // Actually, let's use a simpler series for upper gamma
    return 1 - gammaIncompleteUpper(a, x)
  }
}

function gammaIncompleteUpper(a: number, x: number): number {
  // Use continued fraction for upper incomplete gamma Q(a,x)
  let f = x, c0 = x, d0 = 1
  for (let i = 1; i <= 200; i++) {
    const an = i * (a - i)
    const bn = x + 2 * i + 1 - a
    d0 = bn + an * d0
    if (Math.abs(d0) < 1e-30) d0 = 1e-30
    c0 = bn + an / c0
    if (Math.abs(c0) < 1e-30) c0 = 1e-30
    d0 = 1 / d0
    const delta = c0 * d0
    f *= delta
    if (Math.abs(delta - 1) < 1e-10) break
  }
  return Math.exp(-x + a * Math.log(x) - gammaLn(a)) / f
}

/** Standard normal CDF using error function approximation */
function normalCDF(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma
  return 0.5 * (1 + erf(z / Math.sqrt(2)))
}

/** Standard normal PDF */
function normalPDF(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
}

/** Error function approximation (Abramowitz & Stegun) */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
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

// ─── Normal distribution ────────────────────────────────────────────────

export interface ContinuousResult {
  mean: number
  variance: number
  stdDev: number
  table: TableRow[]
  meanFormula: string
  varianceFormula: string
  stdDevFormula: string
  isContinuous: true
  pdf: (x: number) => number
  cdf: (x: number) => number
}

export function normalBase(mu: number, sigma: number): ContinuousResult {
  const mean = mu
  const variance = sigma * sigma
  const stdDev = sigma

  const pdf = (x: number) => normalPDF(x, mu, sigma)
  const cdf = (x: number) => normalCDF(x, mu, sigma)

  // Generate table from μ-4σ to μ+4σ
  const lo = mu - 4 * sigma
  const hi = mu + 4 * sigma
  const steps = 80
  const dx = (hi - lo) / steps
  const table: TableRow[] = []
  for (let i = 0; i <= steps; i++) {
    const x = lo + i * dx
    table.push({ x: Math.round(x * 1000) / 1000, px: pdf(x), cumulative: cdf(x) })
  }

  return {
    mean, variance, stdDev, table, isContinuous: true, pdf, cdf,
    meanFormula: `μ = ${mu}`,
    varianceFormula: `σ² = ${sigma}² = ${variance}`,
    stdDevFormula: `σ = ${sigma}`,
  }
}

// ─── T-Student distribution ────────────────────────────────────────────

function tStudentPDF(t: number, df: number): number {
  const coeff = gamma((df + 1) / 2) / (Math.sqrt(df * Math.PI) * gamma(df / 2))
  return coeff * Math.pow(1 + t * t / df, -(df + 1) / 2)
}

function tStudentCDF(t: number, df: number): number {
  if (t === 0) return 0.5
  const x = df / (df + t * t)
  const ib = betaIncomplete(x, df / 2, 0.5)
  return t > 0 ? 1 - 0.5 * ib : 0.5 * ib
}

export function tStudentBase(df: number): ContinuousResult {
  const mean = df > 1 ? 0 : NaN
  const variance = df > 2 ? df / (df - 2) : df > 1 ? Infinity : NaN
  const stdDev = Math.sqrt(variance)

  const pdf = (x: number) => tStudentPDF(x, df)
  const cdf = (x: number) => tStudentCDF(x, df)

  const spread = Math.max(4, Math.sqrt(variance) * 4 || 6)
  const lo = -spread, hi = spread
  const steps = 80
  const dx = (hi - lo) / steps
  const table: TableRow[] = []
  for (let i = 0; i <= steps; i++) {
    const x = lo + i * dx
    table.push({ x: Math.round(x * 1000) / 1000, px: pdf(x), cumulative: cdf(x) })
  }

  return {
    mean, variance, stdDev, table, isContinuous: true, pdf, cdf,
    meanFormula: df > 1 ? `μ = 0 (para ν > 1)` : 'μ = No definida (ν ≤ 1)',
    varianceFormula: df > 2 ? `σ² = ν/(ν−2) = ${df}/${df - 2} = ${variance.toFixed(4)}` : 'σ² = ∞ (ν ≤ 2)',
    stdDevFormula: df > 2 ? `σ = √(ν/(ν−2)) = ${stdDev.toFixed(4)}` : 'σ = ∞',
  }
}

// ─── Chi-Square distribution ───────────────────────────────────────────

function chiSquarePDF(x: number, k: number): number {
  if (x <= 0) return 0
  return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - gammaLn(k / 2))
}

function chiSquareCDF(x: number, k: number): number {
  if (x <= 0) return 0
  return gammaIncomplete(k / 2, x / 2)
}

export function chiSquareBase(k: number): ContinuousResult {
  const mean = k
  const variance = 2 * k
  const stdDev = Math.sqrt(variance)

  const pdf = (x: number) => chiSquarePDF(x, k)
  const cdf = (x: number) => chiSquareCDF(x, k)

  const hi = Math.max(mean + 4 * stdDev, k + 10)
  const steps = 80
  const dx = hi / steps
  const table: TableRow[] = []
  for (let i = 0; i <= steps; i++) {
    const x = i * dx
    table.push({ x: Math.round(x * 1000) / 1000, px: pdf(x), cumulative: cdf(x) })
  }

  return {
    mean, variance, stdDev, table, isContinuous: true, pdf, cdf,
    meanFormula: `μ = k = ${k}`,
    varianceFormula: `σ² = 2k = ${variance}`,
    stdDevFormula: `σ = √(2k) = ${stdDev.toFixed(4)}`,
  }
}

// ─── Fisher (F) distribution ───────────────────────────────────────────

function fisherPDF(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  // Use log for numerical stability
  const ln = (d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x)
    - ((d1 + d2) / 2) * Math.log(1 + d1 * x / d2)
    - gammaLn(d1 / 2) - gammaLn(d2 / 2) + gammaLn((d1 + d2) / 2)
  return Math.exp(ln)
}

function fisherCDF(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  const z = (d1 * x) / (d1 * x + d2)
  return betaIncomplete(z, d1 / 2, d2 / 2)
}

export function fisherBase(d1: number, d2: number): ContinuousResult {
  const mean = d2 > 2 ? d2 / (d2 - 2) : NaN
  const variance = d2 > 4
    ? (2 * d2 * d2 * (d1 + d2 - 2)) / (d1 * (d2 - 2) * (d2 - 2) * (d2 - 4))
    : NaN
  const stdDev = Math.sqrt(variance)

  const pdf = (x: number) => fisherPDF(x, d1, d2)
  const cdf = (x: number) => fisherCDF(x, d1, d2)

  const hi = Math.max(isNaN(mean) ? 5 : mean + 4 * (isNaN(stdDev) ? 2 : stdDev), 8)
  const steps = 80
  const dx = hi / steps
  const table: TableRow[] = []
  for (let i = 0; i <= steps; i++) {
    const x = i * dx
    table.push({ x: Math.round(x * 1000) / 1000, px: pdf(x), cumulative: cdf(x) })
  }

  return {
    mean, variance, stdDev, table, isContinuous: true, pdf, cdf,
    meanFormula: d2 > 2 ? `μ = d₂/(d₂−2) = ${d2}/${d2 - 2} = ${mean.toFixed(4)}` : 'μ = No definida (d₂ ≤ 2)',
    varianceFormula: d2 > 4
      ? `σ² = 2d₂²(d₁+d₂−2) / (d₁(d₂−2)²(d₂−4)) = ${variance.toFixed(4)}`
      : 'σ² = No definida (d₂ ≤ 4)',
    stdDevFormula: d2 > 4 ? `σ = ${stdDev.toFixed(4)}` : 'σ = No definida',
  }
}

// ─── Gauss (Normal con tabla Z fija) ───────────────────────────────────

/**
 * Z-table: P(0 ≤ Z ≤ z) for z = 0.00 to 3.09 (310 values)
 * Source: Standard normal distribution table (Abramowitz & Stegun reference)
 */
export const Z_TABLE_DATA: number[] = [
  // z = 0.0x
  0.0000, 0.0040, 0.0080, 0.0120, 0.0160, 0.0199, 0.0239, 0.0279, 0.0319, 0.0359,
  // z = 0.1x
  0.0398, 0.0438, 0.0478, 0.0517, 0.0557, 0.0596, 0.0636, 0.0675, 0.0714, 0.0753,
  // z = 0.2x
  0.0793, 0.0832, 0.0871, 0.0910, 0.0948, 0.0987, 0.1026, 0.1064, 0.1103, 0.1141,
  // z = 0.3x
  0.1179, 0.1217, 0.1255, 0.1293, 0.1331, 0.1368, 0.1406, 0.1443, 0.1480, 0.1517,
  // z = 0.4x
  0.1554, 0.1591, 0.1628, 0.1664, 0.1700, 0.1736, 0.1772, 0.1808, 0.1844, 0.1879,
  // z = 0.5x
  0.1915, 0.1950, 0.1985, 0.2019, 0.2054, 0.2088, 0.2123, 0.2157, 0.2190, 0.2224,
  // z = 0.6x
  0.2257, 0.2291, 0.2324, 0.2357, 0.2389, 0.2422, 0.2454, 0.2486, 0.2517, 0.2549,
  // z = 0.7x
  0.2580, 0.2611, 0.2642, 0.2673, 0.2704, 0.2734, 0.2764, 0.2794, 0.2823, 0.2852,
  // z = 0.8x
  0.2881, 0.2910, 0.2939, 0.2967, 0.2995, 0.3023, 0.3051, 0.3078, 0.3106, 0.3133,
  // z = 0.9x
  0.3159, 0.3186, 0.3212, 0.3238, 0.3264, 0.3289, 0.3315, 0.3340, 0.3365, 0.3389,
  // z = 1.0x
  0.3413, 0.3438, 0.3461, 0.3485, 0.3508, 0.3531, 0.3554, 0.3577, 0.3599, 0.3621,
  // z = 1.1x
  0.3643, 0.3665, 0.3686, 0.3708, 0.3729, 0.3749, 0.3770, 0.3790, 0.3810, 0.3830,
  // z = 1.2x
  0.3849, 0.3869, 0.3888, 0.3907, 0.3925, 0.3944, 0.3962, 0.3980, 0.3997, 0.4015,
  // z = 1.3x
  0.4032, 0.4049, 0.4066, 0.4082, 0.4099, 0.4115, 0.4131, 0.4147, 0.4162, 0.4177,
  // z = 1.4x
  0.4192, 0.4207, 0.4222, 0.4236, 0.4251, 0.4265, 0.4279, 0.4292, 0.4306, 0.4319,
  // z = 1.5x
  0.4332, 0.4345, 0.4357, 0.4370, 0.4382, 0.4394, 0.4406, 0.4418, 0.4429, 0.4441,
  // z = 1.6x
  0.4452, 0.4463, 0.4474, 0.4484, 0.4495, 0.4505, 0.4515, 0.4525, 0.4535, 0.4545,
  // z = 1.7x
  0.4554, 0.4564, 0.4573, 0.4582, 0.4591, 0.4599, 0.4608, 0.4616, 0.4625, 0.4633,
  // z = 1.8x
  0.4641, 0.4649, 0.4656, 0.4664, 0.4671, 0.4678, 0.4686, 0.4693, 0.4699, 0.4706,
  // z = 1.9x
  0.4713, 0.4719, 0.4726, 0.4732, 0.4738, 0.4744, 0.4750, 0.4756, 0.4761, 0.4767,
  // z = 2.0x
  0.4772, 0.4778, 0.4783, 0.4788, 0.4793, 0.4798, 0.4803, 0.4808, 0.4812, 0.4817,
  // z = 2.1x
  0.4821, 0.4826, 0.4830, 0.4834, 0.4838, 0.4842, 0.4846, 0.4850, 0.4854, 0.4857,
  // z = 2.2x
  0.4861, 0.4864, 0.4868, 0.4871, 0.4875, 0.4878, 0.4881, 0.4884, 0.4887, 0.4890,
  // z = 2.3x
  0.4893, 0.4896, 0.4898, 0.4901, 0.4904, 0.4906, 0.4909, 0.4911, 0.4913, 0.4916,
  // z = 2.4x
  0.4918, 0.4920, 0.4922, 0.4925, 0.4927, 0.4929, 0.4931, 0.4932, 0.4934, 0.4936,
  // z = 2.5x
  0.4938, 0.4940, 0.4941, 0.4943, 0.4945, 0.4946, 0.4948, 0.4949, 0.4951, 0.4952,
  // z = 2.6x
  0.4953, 0.4955, 0.4956, 0.4957, 0.4959, 0.4960, 0.4961, 0.4962, 0.4963, 0.4964,
  // z = 2.7x
  0.4965, 0.4966, 0.4967, 0.4968, 0.4969, 0.4970, 0.4971, 0.4972, 0.4973, 0.4974,
  // z = 2.8x
  0.4974, 0.4975, 0.4976, 0.4977, 0.4977, 0.4978, 0.4979, 0.4979, 0.4980, 0.4981,
  // z = 2.9x
  0.4981, 0.4982, 0.4982, 0.4983, 0.4984, 0.4984, 0.4985, 0.4985, 0.4986, 0.4986,
  // z = 3.0x
  0.4987, 0.4987, 0.4987, 0.4988, 0.4988, 0.4989, 0.4989, 0.4989, 0.4990, 0.4990,
]

/** Returns P(0 ≤ Z ≤ |z|) from the fixed reference z-table (rounded to 2 decimals) */
export function zTableArea(z: number): number {
  const idx = Math.min(Math.round(Math.abs(z) * 100), Z_TABLE_DATA.length - 1)
  return Z_TABLE_DATA[idx]
}

/** CDF using fixed z-table: P(X ≤ x) for N(μ, σ) */
export function gaussCDFTable(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma
  const area = zTableArea(z)
  return z >= 0 ? 0.5 + area : 0.5 - area
}

export function gaussBase(mu: number, sigma: number): ContinuousResult {
  const pdf = (x: number) => normalPDF(x, mu, sigma)
  const cdf = (x: number) => gaussCDFTable(x, mu, sigma)

  const lo = mu - 3.5 * sigma
  const hi = mu + 3.5 * sigma
  const steps = 100
  const dx = (hi - lo) / steps
  const table: TableRow[] = []
  for (let i = 0; i <= steps; i++) {
    const x = Math.round((lo + i * dx) * 100) / 100
    table.push({ x, px: pdf(x), cumulative: cdf(x) })
  }

  return {
    mean: mu,
    variance: sigma * sigma,
    stdDev: sigma,
    table,
    isContinuous: true,
    pdf,
    cdf,
    meanFormula: `μ = ${mu}`,
    varianceFormula: `σ² = ${sigma}² = ${(sigma * sigma).toFixed(4)}`,
    stdDevFormula: `σ = ${sigma}`,
  }
}

export function evaluateIncisoGauss(
  mu: number, sigma: number, op: Operator, value: number
): IncisoResult {
  const opLabel: Record<Operator, string> = {
    '=': '=', '>': '>', '<': '<', '>=': '≥', '<=': '≤', '!=': '≠',
  }

  const cdf = (x: number) => gaussCDFTable(x, mu, sigma)
  const z = (value - mu) / sigma
  const zr = Math.round(z * 100) / 100
  const area = zTableArea(Math.abs(zr))

  let probability: number
  switch (op) {
    case '=':  probability = 0; break
    case '!=': probability = 1; break
    case '<': case '<=': probability = cdf(value); break
    case '>': case '>=': probability = 1 - cdf(value); break
    default:   probability = 0
  }

  const steps: Step[] = [
    {
      label: 'Z-score',
      expression: `z = (x − μ) / σ = (${value} − ${mu}) / ${sigma}`,
      value: zr.toFixed(2),
    },
    {
      label: 'Tabla Z',
      expression: `P(0 ≤ Z ≤ ${Math.abs(zr).toFixed(2)})`,
      value: area.toFixed(4),
    },
  ]

  if (op === '=' || op === '!=') {
    steps.push({
      label: 'Nota',
      expression: op === '='
        ? 'En distribuciones continuas P(X = x) = 0'
        : 'En distribuciones continuas P(X ≠ x) = 1',
      value: probability.toFixed(4),
    })
  } else if (op === '<' || op === '<=') {
    if (zr === 0) {
      steps.push({ label: 'Cálculo', expression: 'z = 0 → P = 0.5', value: '0.5000' })
    } else if (zr > 0) {
      steps.push({
        label: 'Regla',
        expression: 'z > 0 → mitad izquierda + área(0 a z)',
        value: '',
      })
      steps.push({
        label: 'Cálculo',
        expression: `0.5 + ${area.toFixed(4)}`,
        value: probability.toFixed(4),
      })
    } else {
      steps.push({
        label: 'Regla 2',
        expression: 'z < 0 → cola izquierda = 0.5 − área(0 a |z|)',
        value: '',
      })
      steps.push({
        label: 'Cálculo',
        expression: `0.5 − ${area.toFixed(4)}`,
        value: probability.toFixed(4),
      })
    }
  } else {
    // > or >=
    if (zr === 0) {
      steps.push({ label: 'Cálculo', expression: 'z = 0 → P = 0.5', value: '0.5000' })
    } else if (zr > 0) {
      steps.push({
        label: 'Regla 2',
        expression: 'z > 0 → área superior = 0.5 − área(0 a z)',
        value: '',
      })
      steps.push({
        label: 'Cálculo',
        expression: `0.5 − ${area.toFixed(4)}`,
        value: probability.toFixed(4),
      })
    } else {
      steps.push({
        label: 'Regla',
        expression: 'z < 0 → área superior = 0.5 + área(0 a |z|)',
        value: '',
      })
      steps.push({
        label: 'Cálculo',
        expression: `0.5 + ${area.toFixed(4)}`,
        value: probability.toFixed(4),
      })
    }
  }

  steps.push({
    label: 'Resultado',
    expression: `P(X ${opLabel[op]} ${value})`,
    value: probability.toFixed(4),
  })

  return {
    probability,
    matchingRows: [],
    steps,
    interpretation: `P(X ${opLabel[op]} ${value}) = ${probability.toFixed(4)} (${(probability * 100).toFixed(2)}%)`,
  }
}

export function evaluateIncisoGaussRange(
  mu: number, sigma: number,
  low: number, opLow: RangeOp, opHigh: RangeOp, high: number
): IncisoResult {
  const opLowLabel = opLow === '<' ? '<' : '≤'
  const opHighLabel = opHigh === '<' ? '<' : '≤'
  const condExpr = `P(${low} ${opLowLabel} X ${opHighLabel} ${high})`

  const cdf = (x: number) => gaussCDFTable(x, mu, sigma)
  const probability = cdf(high) - cdf(low)

  const z1 = (low - mu) / sigma
  const z2 = (high - mu) / sigma
  const z1r = Math.round(z1 * 100) / 100
  const z2r = Math.round(z2 * 100) / 100
  const a1 = zTableArea(Math.abs(z1r))
  const a2 = zTableArea(Math.abs(z2r))

  const steps: Step[] = [
    { label: 'Z₁', expression: `z₁ = (${low} − ${mu}) / ${sigma}`, value: z1r.toFixed(2) },
    { label: 'Z₂', expression: `z₂ = (${high} − ${mu}) / ${sigma}`, value: z2r.toFixed(2) },
    { label: 'A₁ (tabla)', expression: `P(0 ≤ Z ≤ ${Math.abs(z1r).toFixed(2)})`, value: a1.toFixed(4) },
    { label: 'A₂ (tabla)', expression: `P(0 ≤ Z ≤ ${Math.abs(z2r).toFixed(2)})`, value: a2.toFixed(4) },
  ]

  if (z1r === 0) {
    // Rule 1: area from mean to z2, direct lookup
    steps.push({ label: 'Regla 1', expression: 'Límite inferior = μ → búsqueda directa en tabla', value: '' })
    steps.push({ label: 'Cálculo', expression: `A₂ = ${a2.toFixed(4)}`, value: probability.toFixed(4) })
  } else if (z2r === 0) {
    // Rule 1: area from z1 to mean, direct lookup
    steps.push({ label: 'Regla 1', expression: 'Límite superior = μ → búsqueda directa en tabla', value: '' })
    steps.push({ label: 'Cálculo', expression: `A₁ = ${a1.toFixed(4)}`, value: probability.toFixed(4) })
  } else if (z1r < 0 && z2r > 0) {
    // Rule 3: different sides of the mean — add areas
    steps.push({ label: 'Regla 3', expression: 'Puntos en lados distintos de la media → se suman las áreas', value: '' })
    steps.push({ label: 'Cálculo', expression: `A₁ + A₂ = ${a1.toFixed(4)} + ${a2.toFixed(4)}`, value: probability.toFixed(4) })
  } else {
    // Rule 4: same side — subtract smaller from larger
    const aLarge = Math.max(a1, a2)
    const aSmall = Math.min(a1, a2)
    steps.push({ label: 'Regla 4', expression: 'Mismo lado de la media → área mayor − área menor', value: '' })
    steps.push({ label: 'Cálculo', expression: `${aLarge.toFixed(4)} − ${aSmall.toFixed(4)}`, value: probability.toFixed(4) })
  }

  steps.push({ label: 'Resultado', expression: condExpr, value: probability.toFixed(4) })

  return {
    probability,
    matchingRows: [],
    steps,
    interpretation: `${condExpr} = ${probability.toFixed(4)} (${(probability * 100).toFixed(2)}%)`,
  }
}

// ─── Inverse Z-table lookup ────────────────────────────────────────────

/** Find z (to 2 decimal places) such that P(0 ≤ Z ≤ z) ≈ area */
export function inverseZTable(area: number): number {
  if (area <= 0) return 0
  if (area >= Z_TABLE_DATA[Z_TABLE_DATA.length - 1]) return (Z_TABLE_DATA.length - 1) / 100
  let bestIdx = 0
  let bestDiff = Math.abs(Z_TABLE_DATA[0] - area)
  for (let i = 1; i < Z_TABLE_DATA.length; i++) {
    const diff = Math.abs(Z_TABLE_DATA[i] - area)
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
  }
  return bestIdx / 100
}

export interface GaussSolveResult {
  x: number
  z: number
  steps: Step[]
}

/** Despeje de x: dado P(X op x) = probability, encuentra x usando la tabla Z */
export function solveGaussX(mu: number, sigma: number, op: Operator, probability: number): GaussSolveResult {
  const steps: Step[] = []

  if (op === '=' || op === '!=') {
    return { x: NaN, z: NaN, steps: [{ label: 'Error', expression: 'Usa ≤ o ≥ para despejar x', value: '' }] }
  }

  // Convert to P(X ≤ x) = targetCDF
  let targetCDF = probability
  if (op === '>' || op === '>=') {
    targetCDF = 1 - probability
    steps.push({
      label: 'Conversión',
      expression: `P(X > x) = ${probability.toFixed(4)} → P(X ≤ x) = 1 − ${probability.toFixed(4)}`,
      value: targetCDF.toFixed(4),
    })
  }

  let z: number
  if (Math.abs(targetCDF - 0.5) < 0.00001) {
    z = 0
    steps.push({ label: 'Z', expression: 'P = 0.5 → z = 0 (valor en la media)', value: '0.00' })
  } else if (targetCDF > 0.5) {
    const area = targetCDF - 0.5
    steps.push({ label: 'Área', expression: `P(0 ≤ Z ≤ z) = ${targetCDF.toFixed(4)} − 0.5`, value: area.toFixed(4) })
    z = inverseZTable(area)
    steps.push({ label: 'Z (tabla)', expression: `z tal que P(0 ≤ Z ≤ z) ≈ ${area.toFixed(4)}`, value: z.toFixed(2) })
  } else {
    const area = 0.5 - targetCDF
    steps.push({ label: 'Área', expression: `P(0 ≤ Z ≤ |z|) = 0.5 − ${targetCDF.toFixed(4)}`, value: area.toFixed(4) })
    z = -inverseZTable(area)
    steps.push({ label: 'Z (tabla)', expression: `−z tal que P(0 ≤ Z ≤ |z|) ≈ ${area.toFixed(4)}`, value: z.toFixed(2) })
  }

  const x = mu + z * sigma
  steps.push({
    label: 'Despeje',
    expression: `x = μ + z · σ = ${mu} + (${z.toFixed(2)}) · ${sigma}`,
    value: x.toFixed(4),
  })

  return { x, z, steps }
}

// ─── Continuous inciso evaluators ──────────────────────────────────────

export function evaluateIncisoContinuous(
  cdf: (x: number) => number, op: Operator, value: number
): IncisoResult {
  const opLabel: Record<Operator, string> = {
    '=': '=', '>': '>', '<': '<', '>=': '≥', '<=': '≤', '!=': '≠',
  }

  let probability: number
  switch (op) {
    case '=':
    case '!=':
      // For continuous distributions P(X = x) = 0, P(X ≠ x) = 1
      probability = op === '=' ? 0 : 1
      break
    case '<':
    case '<=':
      probability = cdf(value)
      break
    case '>':
    case '>=':
      probability = 1 - cdf(value)
      break
  }

  const steps: Step[] = [
    { label: 'Condición', expression: `P(X ${opLabel[op]} ${value})`, value: '' },
  ]

  if (op === '=' || op === '!=') {
    steps.push({
      label: 'Nota',
      expression: op === '='
        ? 'En distribuciones continuas, P(X = x) = 0'
        : 'En distribuciones continuas, P(X ≠ x) = 1',
      value: probability.toFixed(4),
    })
  } else if (op === '<' || op === '<=') {
    steps.push({
      label: 'CDF',
      expression: `F(${value})`,
      value: probability.toFixed(4),
    })
  } else {
    steps.push({
      label: 'Complemento',
      expression: `1 − F(${value}) = 1 − ${cdf(value).toFixed(4)}`,
      value: probability.toFixed(4),
    })
  }

  steps.push({ label: 'Resultado', expression: `P(X ${opLabel[op]} ${value})`, value: probability.toFixed(4) })

  return {
    probability,
    matchingRows: [],
    steps,
    interpretation: `P(X ${opLabel[op]} ${value}) = ${probability.toFixed(4)} (${(probability * 100).toFixed(2)}%)`,
  }
}

export function evaluateIncisoContinuousRange(
  cdf: (x: number) => number,
  low: number, opLow: RangeOp, opHigh: RangeOp, high: number
): IncisoResult {
  const opLowLabel = opLow === '<' ? '<' : '≤'
  const opHighLabel = opHigh === '<' ? '<' : '≤'
  const condExpr = `P(${low} ${opLowLabel} X ${opHighLabel} ${high})`

  // For continuous: P(a < X < b) = F(b) - F(a) (same whether strict or not)
  const probability = cdf(high) - cdf(low)

  const steps: Step[] = [
    { label: 'Condición', expression: condExpr, value: '' },
    { label: 'CDF', expression: `F(${high}) − F(${low}) = ${cdf(high).toFixed(4)} − ${cdf(low).toFixed(4)}`, value: probability.toFixed(4) },
    { label: 'Resultado', expression: condExpr, value: probability.toFixed(4) },
  ]

  return {
    probability,
    matchingRows: [],
    steps,
    interpretation: `${condExpr} = ${probability.toFixed(4)} (${(probability * 100).toFixed(2)}%)`,
  }
}
