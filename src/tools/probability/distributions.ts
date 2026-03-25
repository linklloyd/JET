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
