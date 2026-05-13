import { useState } from 'react'
import { Plus, Trash2, Calculator, BarChart2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { MathDisplay } from '../../components/ui/MathInput'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// ─── Math helpers ─────────────────────────────────────────────────────────────

function rnd(x: number, dec: number): number {
  return Number(Math.round(Number(x + 'e' + dec)) + 'e-' + dec)
}
function r4(x: number) { return rnd(x, 4) }
function r2(x: number) { return rnd(x, 2) }
function f4(x: number): string { return parseFloat(rnd(x, 4).toFixed(4)).toString() }
function f2(x: number): string { return parseFloat(rnd(x, 2).toFixed(2)).toString() }

// ─── Combinations ─────────────────────────────────────────────────────────────

function combinations(indices: number[], k: number): number[][] {
  if (k === 0) return [[]]
  if (indices.length < k) return []
  const [first, ...rest] = indices
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k),
  ]
}

function factorial(n: number): number {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function comb(n: number, k: number): number {
  if (k > n) return 0
  return factorial(n) / (factorial(k) * factorial(n - k))
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PopRow { label: string; value: string }

interface Sample {
  id: number
  labels: string[]
  values: number[]
  sum: number
  mean: number
}

interface DistRow {
  mean: number
  freq: number
  prob: number
}

interface SamplingResult {
  N: number
  n: number
  popData: { label: string; val: number }[]
  popSum: number
  mu: number
  deviations: { label: string; val: number; dev: number; devSq: number }[]
  sumDevSq: number
  popVariance: number
  popStdDev: number
  numSamples: number
  samples: Sample[]
  dist: DistRow[]
  muXBar: number
  sigmaXBar: number
  fpc: number
}

// ─── Computation ──────────────────────────────────────────────────────────────

function computeSampling(rows: PopRow[], n: number): SamplingResult | null {
  const valid = rows.filter(r => r.label.trim() !== '' && r.value.trim() !== '' && !isNaN(+r.value))
  if (valid.length < 2 || n < 1 || n >= valid.length) return null

  const popData = valid.map(r => ({ label: r.label.trim(), val: +r.value }))
  const N = popData.length
  const popSum = r4(popData.reduce((s, d) => s + d.val, 0))
  const mu = r4(popSum / N)

  const deviations = popData.map(d => ({
    label: d.label,
    val: d.val,
    dev: r4(d.val - mu),
    devSq: r4((d.val - mu) ** 2),
  }))
  const sumDevSq = r4(deviations.reduce((s, d) => s + d.devSq, 0))
  const popVariance = r4(sumDevSq / N)
  const popStdDev = r4(Math.sqrt(popVariance))

  // All possible samples of size n
  const indices = popData.map((_, i) => i)
  const combos = combinations(indices, n)
  const numSamples = comb(N, n)

  const samples: Sample[] = combos.map((idxs, i) => {
    const labels = idxs.map(j => popData[j].label)
    const values = idxs.map(j => popData[j].val)
    const sum = r4(values.reduce((s, v) => s + v, 0))
    const mean = r4(sum / n)
    return { id: i + 1, labels, values, sum, mean }
  })

  // Sampling distribution
  const freqMap = new Map<number, number>()
  samples.forEach(s => freqMap.set(s.mean, (freqMap.get(s.mean) ?? 0) + 1))
  const dist: DistRow[] = [...freqMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([mean, freq]) => ({ mean, freq, prob: r4(freq / numSamples) }))

  const muXBar = r4(dist.reduce((s, d) => s + d.mean * d.prob, 0))

  // Standard error with finite population correction
  const fpc = r4(Math.sqrt((N - n) / (N - 1)))
  const sigmaXBar = r4((popStdDev / Math.sqrt(n)) * fpc)

  return {
    N, n, popData, popSum, mu,
    deviations, sumDevSq, popVariance, popStdDev,
    numSamples, samples, dist, muXBar, sigmaXBar, fpc,
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

const EMPTY_ROWS: PopRow[] = Array.from({ length: 5 }, () => ({ label: '', value: '' }))

export function SamplingPage() {
  const [rows, setRows, savedAt] = useLocalStorage<PopRow[]>('jet-sampling-rows', EMPTY_ROWS)
  const [n, setN, nSavedAt] = useLocalStorage<number>('jet-sampling-n', 2)
  const [result, setResult] = useState<SamplingResult | null>(null)
  const [error, setError] = useState('')

  const lastSaved = savedAt ?? nSavedAt

  const addRow = () => setRows(r => [...r, { label: '', value: '' }])
  const removeRow = (i: number) => setRows(r => r.filter((_, j) => j !== i))
  const updateRow = (i: number, field: 'label' | 'value', val: string) =>
    setRows(r => r.map((row, j) => j === i ? { ...row, [field]: val } : row))

  const validCount = rows.filter(r => r.label.trim() !== '' && r.value.trim() !== '' && !isNaN(+r.value)).length

  const handleCalculate = () => {
    if (n >= validCount) {
      setError(`n debe ser menor que N (${validCount}). Ingresa n ≤ ${validCount - 1}.`)
      setResult(null)
      return
    }
    const res = computeSampling(rows, n)
    if (!res) { setError('Ingresa al menos 2 elementos válidos y un n < N.'); setResult(null) }
    else { setError(''); setResult(res) }
  }

  const numSamplesPreview = validCount >= 2 && n >= 1 && n < validCount ? comb(validCount, n) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Distribución Muestral de Medias</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Ingresa la población y el tamaño de muestra <span className="font-mono italic">n</span> para generar todas las muestras posibles
          </p>
        </div>
        {lastSaved && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Datos guardados
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Población</p>
          <Button onClick={addRow} variant="secondary" size="sm">
            <Plus size={13} /> Agregar elemento
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-200">
                <th className="text-left px-2 py-1.5 text-xs font-semibold text-zinc-400 w-10">i</th>
                <th className="text-left px-2 py-1.5 text-xs font-semibold text-blue-600">Elemento</th>
                <th className="text-left px-2 py-1.5 text-xs font-semibold text-emerald-600">Valor (x)</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  <td className="px-2 py-1 text-xs text-zinc-400 font-mono">{i + 1}</td>
                  <td className="px-2 py-1">
                    <input
                      type="text" value={row.label} placeholder="A"
                      onChange={e => updateRow(i, 'label', e.target.value)}
                      className="w-full rounded border border-zinc-200 px-2 py-1 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number" value={row.value} step="any" placeholder="0"
                      onChange={e => updateRow(i, 'value', e.target.value)}
                      className="w-full rounded border border-zinc-200 px-2 py-1 text-sm font-mono outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    {rows.length > 2 && (
                      <button onClick={() => removeRow(i)} className="text-zinc-300 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sample size n */}
        <div className="mt-5 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-zinc-600 uppercase tracking-wide">
              Tamaño de muestra (n)
            </label>
            <input
              type="number" min={1} max={validCount > 1 ? validCount - 1 : 1}
              value={n}
              onChange={e => setN(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 rounded border border-zinc-200 px-2 py-1 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          {numSamplesPreview !== null && (
            <div className="text-xs text-zinc-400">
              → <span className="font-semibold text-zinc-600">C({validCount}, {n}) = {numSamplesPreview}</span> muestras posibles
            </div>
          )}
          {numSamplesPreview !== null && numSamplesPreview > 500 && (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              ⚠ Más de 500 muestras — considera reducir N o n
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        <div className="mt-4">
          <Button onClick={handleCalculate} variant="primary" size="md">
            <Calculator size={14} /> Calcular
          </Button>
        </div>
      </div>

      {result && <Results res={result} />}
    </div>
  )
}

// ─── Results ──────────────────────────────────────────────────────────────────

function Results({ res }: { res: SamplingResult }) {
  return (
    <div className="space-y-6">

      {/* ── 1. Estadísticas de la población ── */}
      <Panel title="Estadísticas de la Población">
        <div className="space-y-4">
          {/* Tabla de población */}
          <STable
            headers={['Elem.', 'x', 'x − μ', '(x − μ)²']}
            rows={res.deviations.map(d => [d.label, d.val, f4(d.dev), f4(d.devSq)])}
            sumRow={['Σ', f4(res.popSum), '0', f4(res.sumDevSq)]}
            colColors={['zinc', 'blue', 'zinc', 'blue']}
          />

          {/* Media poblacional */}
          <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Media poblacional (μ)</p>
            <MathDisplay latex="\\mu = \\frac{\\sum x_i}{N}" className="text-sm" />
            <p className="text-xs font-mono text-zinc-500 mt-1">
              μ = {f4(res.popSum)} / {res.N}
            </p>
            <ResultBadge label="μ =" value={f4(res.mu)} color="blue" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Varianza */}
            <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Varianza poblacional (σ²)</p>
              <MathDisplay latex="\\sigma^2 = \\frac{\\sum(x_i - \\mu)^2}{N}" className="text-sm" />
              <p className="text-xs font-mono text-zinc-500 mt-1">
                σ² = {f4(res.sumDevSq)} / {res.N}
              </p>
              <ResultBadge label="σ² =" value={f4(res.popVariance)} color="purple" />
            </div>
            {/* Desv. estándar */}
            <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Desv. estándar poblacional (σ)</p>
              <MathDisplay latex="\\sigma = \\sqrt{\\sigma^2}" className="text-sm" />
              <p className="text-xs font-mono text-zinc-500 mt-1">
                σ = √{f4(res.popVariance)}
              </p>
              <ResultBadge label="σ =" value={f4(res.popStdDev)} color="emerald" />
            </div>
          </div>
        </div>
      </Panel>

      {/* ── 2. Todas las muestras posibles ── */}
      <Panel title={`Todas las Muestras Posibles — C(${res.N}, ${res.n}) = ${res.numSamples}`}>
        <div className="space-y-3">
          <div className="bg-zinc-50 rounded-lg px-4 py-2 text-xs text-zinc-500">
            <MathDisplay latex={`\\binom{N}{n} = \\binom{${res.N}}{${res.n}} = \\frac{${res.N}!}{${res.n}!(${res.N}-${res.n})!} = ${res.numSamples}`} className="text-sm" />
          </div>
          <STable
            headers={['#', 'Muestra', 'Valores', 'Σ', 'x̄']}
            rows={res.samples.map(s => [
              s.id,
              `{${s.labels.join(', ')}}`,
              s.values.join(', '),
              f4(s.sum),
              f4(s.mean),
            ])}
            sumRow={null}
            colColors={['zinc', 'blue', 'zinc', 'zinc', 'purple']}
          />
        </div>
      </Panel>

      {/* ── 3. Distribución muestral de medias ── */}
      <Panel title="Distribución Muestral de Medias">
        <div className="space-y-4">
          <STable
            headers={['x̄', 'Frecuencia', 'P(x̄)']}
            rows={res.dist.map(d => [f4(d.mean), d.freq, f4(d.prob)])}
            sumRow={['Σ', res.numSamples, '1']}
            colColors={['purple', 'blue', 'emerald']}
          />

          {/* Media de la distribución */}
          <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Media de la distribución muestral (μx̄)</p>
            <MathDisplay latex="\\mu_{\\bar{x}} = \\sum \\bar{x} \\cdot P(\\bar{x})" className="text-sm" />
            <p className="text-xs font-mono text-zinc-500 mt-1">
              μx̄ = {res.dist.map(d => `${f4(d.mean)}·${f4(d.prob)}`).join(' + ')}
            </p>
            <ResultBadge label="μx̄ =" value={f4(res.muXBar)} color="purple" />
            {rnd(res.muXBar, 2) === rnd(res.mu, 2) ? (
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-700 font-medium">
                ✓ μx̄ = μ = {f4(res.mu)} — la distribución muestral es insesgada
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700">
                μx̄ = {f4(res.muXBar)} ≠ μ = {f4(res.mu)} (diferencia por redondeo)
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* ── 4. Error estándar ── */}
      <Panel title="Error Estándar de la Media (σx̄)">
        <div className="space-y-4">
          <div className="bg-zinc-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Fórmula (con corrección de población finita)</p>
            <MathDisplay
              latex="\\sigma_{\\bar{x}} = \\frac{\\sigma}{\\sqrt{n}} \\cdot \\sqrt{\\frac{N-n}{N-1}}"
              className="text-sm"
            />
            <div className="text-xs font-mono text-zinc-500 space-y-1 mt-1">
              <p>σx̄ = {f4(res.popStdDev)} / √{res.n} · √(({res.N}−{res.n}) / ({res.N}−1))</p>
              <p>σx̄ = {f4(res.popStdDev)} / {f4(Math.sqrt(res.n))} · √({res.N - res.n}/{res.N - 1})</p>
              <p>σx̄ = {f4(res.popStdDev / Math.sqrt(res.n))} · {f4(res.fpc)}</p>
            </div>
          </div>
          <ResultBadge label="σx̄ =" value={f4(res.sigmaXBar)} color="amber" />

          {/* Interpretación */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-1">
            <p><span className="font-bold">N = {res.N}</span> elementos en la población &nbsp;·&nbsp; <span className="font-bold">n = {res.n}</span> por muestra</p>
            <p><span className="font-bold">C({res.N},{res.n}) = {res.numSamples}</span> muestras posibles</p>
            <p>El error estándar <span className="font-mono font-bold">σx̄ = {f4(res.sigmaXBar)}</span> indica la dispersión promedio de las medias muestrales respecto a μ = {f4(res.mu)}.</p>
            <p>La corrección de población finita (FPC = {f4(res.fpc)}) reduce el error porque la muestra representa una fracción significativa de la población.</p>
          </div>
        </div>
      </Panel>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type ColColor = 'zinc' | 'blue' | 'emerald' | 'purple' | 'amber'
const COL_COLORS: Record<ColColor, string> = {
  zinc: 'text-zinc-700', blue: 'text-blue-700',
  emerald: 'text-emerald-700', purple: 'text-purple-700', amber: 'text-amber-700',
}

function STable({ headers, rows, sumRow, colColors }: {
  headers: string[]
  rows: (string | number)[][]
  sumRow: (string | number)[] | null
  colColors: ColColor[]
}) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-100">
      <table className="w-full text-sm font-mono">
        <thead className="bg-zinc-50 sticky top-0">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 text-left text-xs font-semibold border-b border-zinc-200 ${COL_COLORS[colColors[i] ?? 'zinc']}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-zinc-100 hover:bg-zinc-50">
              {row.map((cell, ci) => (
                <td key={ci} className={`px-3 py-1.5 ${COL_COLORS[colColors[ci] ?? 'zinc']}`}>{cell}</td>
              ))}
            </tr>
          ))}
          {sumRow && (
            <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold">
              {sumRow.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2 ${COL_COLORS[colColors[ci] ?? 'zinc']}`}>{cell}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ResultBadge({ label, value, color }: { label: string; value: string; color: ColColor }) {
  const bg: Record<ColColor, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    zinc: 'bg-zinc-50 border-zinc-200 text-zinc-900',
  }
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-mono font-bold ${bg[color]}`}>
      <span className="text-sm">{label}</span>
      <span className="text-xl">{value}</span>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 size={14} className="text-zinc-400" />
        <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">{title}</p>
      </div>
      {children}
    </div>
  )
}
