import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Calculator, TrendingUp, Copy, ClipboardPaste } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { MathDisplay } from '../../components/ui/MathInput'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// ─── Math helpers ─────────────────────────────────────────────────────────────

// Redondeo matemático correcto: evita el error de punto flotante
// (ej. 1.185 * 100 = 118.4999... en JS → redondearía mal sin epsilon)
function rnd(x: number, dec: number): number {
  return Number(Math.round(Number(x + 'e' + dec)) + 'e-' + dec)
}
function r4(x: number): number { return rnd(x, 4) }
function r2(x: number): number { return rnd(x, 2) }
function f4(x: number): string { return parseFloat(rnd(x, 4).toFixed(4)).toString() }
function f2(x: number): string { return parseFloat(rnd(x, 2).toFixed(2)).toString() }

function calcMean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function calcMedian(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function calcMode(arr: number[]): number[] {
  const freq: Record<number, number> = {}
  arr.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
  const maxF = Math.max(...Object.values(freq))
  if (maxF <= 1) return []
  return Object.entries(freq)
    .filter(([, f]) => f === maxF)
    .map(([v]) => Number(v))
    .sort((a, b) => a - b)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataRow { x: string; y: string }

interface RegressionResult {
  n: number
  xData: number[]; yData: number[]
  xSum: number; ySum: number
  xMean: number; yMean: number
  xMedian: number; yMedian: number
  xMode: number[]; yMode: number[]
  xRows: { i: number; x: number; dev: number; devSq: number }[]
  yRows: { i: number; y: number; dev: number; devSq: number }[]
  crossRows: { i: number; x: number; y: number; xDev: number; yDev: number; cross: number }[]
  sumXDevSq: number; sumYDevSq: number; sumCross: number
  xVariance: number; yVariance: number
  xStdDev: number; yStdDev: number
  r: number; t: number
  b: number; a: number
  errorRows: { i: number; y: number; yHat: number; res: number; resSq: number }[]
  sumResidualSq: number
  sxy: number
}

// ─── Computation ──────────────────────────────────────────────────────────────

function computeRegression(rows: DataRow[]): RegressionResult | null {
  const valid = rows.filter(r => r.x.trim() !== '' && r.y.trim() !== '' && !isNaN(+r.x) && !isNaN(+r.y))
  if (valid.length < 2) return null

  const xData = valid.map(r => +r.x)
  const yData = valid.map(r => +r.y)
  const n = xData.length

  const xSum = xData.reduce((s, v) => s + v, 0)
  const ySum = yData.reduce((s, v) => s + v, 0)
  const xMean = calcMean(xData)
  const yMean = calcMean(yData)

  const xRows = xData.map((x, i) => ({
    i: i + 1, x,
    dev: r4(x - xMean),
    devSq: r4((x - xMean) ** 2),
  }))

  const yRows = yData.map((y, i) => ({
    i: i + 1, y,
    dev: r4(y - yMean),
    devSq: r4((y - yMean) ** 2),
  }))

  const crossRows = xData.map((x, i) => {
    const y = yData[i]
    const xDev = r4(x - xMean)
    const yDev = r4(y - yMean)
    return { i: i + 1, x, y, xDev, yDev, cross: r4(xDev * yDev) }
  })

  const sumXDevSq = r4(xRows.reduce((s, r) => s + r.devSq, 0))
  const sumYDevSq = r4(yRows.reduce((s, r) => s + r.devSq, 0))
  const sumCross  = r4(crossRows.reduce((s, r) => s + r.cross, 0))

  const xVariance = r4(sumXDevSq / (n - 1))
  const yVariance = r4(sumYDevSq / (n - 1))
  const xStdDev = r2(Math.sqrt(xVariance))
  const yStdDev = r2(Math.sqrt(yVariance))

  const rRaw = sumCross / ((n - 1) * Math.sqrt(xVariance) * Math.sqrt(yVariance))
  const r = r2(rRaw)
  const t = r2(rRaw * Math.sqrt(n - 2) / Math.sqrt(1 - rRaw ** 2))

  const b = r4(sumCross / sumXDevSq)
  const bFinal = r2(b)
  const a = r4(yMean - bFinal * xMean)
  const a2 = r2(a), b2 = r2(b)

  // Error de estimación
  const errorRows = yData.map((y, i) => {
    const yHat = r4(a2 + b2 * xData[i])
    const res   = r4(y - yHat)
    return { i: i + 1, y, yHat, res, resSq: r4(res * res) }
  })
  const sumResidualSq = r4(errorRows.reduce((s, r) => s + r.resSq, 0))
  const sxy = r2(Math.sqrt(sumResidualSq / (n - 2)))

  return {
    n, xData, yData, xSum, ySum,
    xMean: r4(xMean), yMean: r4(yMean),
    xMedian: calcMedian(xData), yMedian: calcMedian(yData),
    xMode: calcMode(xData), yMode: calcMode(yData),
    xRows, yRows, crossRows,
    sumXDevSq, sumYDevSq, sumCross,
    xVariance, yVariance, xStdDev, yStdDev,
    r, t, b, a,
    errorRows, sumResidualSq, sxy,
  }
}

// ─── Copy / Paste buttons (same pattern as Matrices) ─────────────────────────

function DataCopyPaste({ rows, onPaste }: {
  rows: DataRow[]
  onPaste: (rows: DataRow[]) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = rows
      .filter(r => r.x.trim() !== '' || r.y.trim() !== '')
      .map(r => `${r.x}\t${r.y}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const lines = text.trim().split('\n').filter(l => l.trim())
      const parsed: DataRow[] = lines.flatMap(line => {
        const parts = line.trim().split(/[\t,;]+/)
        if (parts.length < 2) return []
        return [{ x: parts[0].trim(), y: parts[1].trim() }]
      })
      if (parsed.length >= 2) onPaste(parsed)
    } catch { /* clipboard permission denied */ }
  }

  return (
    <div className="flex items-center gap-0.5">
      <button onClick={handleCopy}
        className="p-1.5 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="Copiar datos (X Y)">
        <Copy size={13} />
      </button>
      <button onClick={handlePaste}
        className="p-1.5 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="Pegar datos desde Excel">
        <ClipboardPaste size={13} />
      </button>
      {copied && <span className="text-[10px] text-green-600 font-medium ml-1">Copiado!</span>}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSavedAt(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `hace ${hrs} h`
  return `hace ${Math.floor(hrs / 24)} días`
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function LinearRegressionPage() {
  const [rows, setRows, savedAt] = useLocalStorage<DataRow[]>(
    'jet-regression-rows',
    Array.from({ length: 6 }, () => ({ x: '', y: '' })),
  )

  const [result, setResult] = useState<RegressionResult | null>(null)
  const [error, setError] = useState('')

  const addRow = () => setRows(r => [...r, { x: '', y: '' }])
  const removeRow = (i: number) => setRows(r => r.filter((_, j) => j !== i))
  const updateRow = (i: number, field: 'x' | 'y', val: string) =>
    setRows(r => r.map((row, j) => j === i ? { ...row, [field]: val } : row))

  const handleCalculate = () => {
    const res = computeRegression(rows)
    if (!res) { setError('Ingresa al menos 2 pares de datos válidos.'); setResult(null) }
    else { setError(''); setResult(res) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Regresión Lineal</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Ingresa los datos para calcular la recta de regresión&nbsp;
            <span className="font-mono italic">ŷ = a + b(x)</span>
          </p>
        </div>
        {savedAt && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Datos guardados · {formatSavedAt(savedAt)}
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Datos</p>
          <div className="flex items-center gap-2">
            <DataCopyPaste rows={rows} onPaste={setRows} />
            <Button onClick={addRow} variant="secondary" size="sm">
              <Plus size={13} /> Agregar fila
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-200">
                <th className="text-left px-2 py-1.5 text-xs font-semibold text-zinc-400 w-10">i</th>
                <th className="text-left px-2 py-1.5 text-xs font-semibold text-blue-600">X</th>
                <th className="text-left px-2 py-1.5 text-xs font-semibold text-emerald-600">Y</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  <td className="px-2 py-1 text-xs text-zinc-400 font-mono">{i + 1}</td>
                  <td className="px-2 py-1">
                    <input
                      type="number" value={row.x} step="any"
                      onChange={e => updateRow(i, 'x', e.target.value)}
                      className="w-full rounded border border-zinc-200 px-2 py-1 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number" value={row.y} step="any"
                      onChange={e => updateRow(i, 'y', e.target.value)}
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
        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        <div className="mt-4">
          <Button onClick={handleCalculate} variant="primary" size="md">
            <Calculator size={14} /> Calcular
          </Button>
        </div>
      </div>

      {/* ── Results ── */}
      {result && <Results res={result} />}
    </div>
  )
}

// ─── Results section ──────────────────────────────────────────────────────────

function Results({ res }: { res: RegressionResult }) {
  return (
    <div className="space-y-6">

      {/* ── Tabla X ── */}
      <Panel title="Tabla de X">
        <DataTable
          headers={['i', 'x', 'x − x̄', '(x − x̄)²']}
          rows={res.xRows.map(r => [r.i, r.x, f4(r.dev), f4(r.devSq)])}
          sumRow={['Σ', f4(res.xSum), '0.0000', f4(res.sumXDevSq)]}
          colColors={['zinc', 'blue', 'zinc', 'blue']}
        />
      </Panel>

      {/* ── Estadísticas X ── */}
      <Panel title="Estadísticas de X">
        <StatsBlock
          data={res.xData}
          sum={res.xSum}
          mean={res.xMean}
          median={res.xMedian}
          mode={res.xMode}
          sumDevSq={res.sumXDevSq}
          variance={res.xVariance}
          stdDev={res.xStdDev}
          varName="x"
        />
      </Panel>

      {/* ── Tabla Y ── */}
      <Panel title="Tabla de Y">
        <DataTable
          headers={['i', 'y', 'y − ȳ', '(y − ȳ)²']}
          rows={res.yRows.map(r => [r.i, r.y, f4(r.dev), f4(r.devSq)])}
          sumRow={['Σ', f4(res.ySum), '0.0000', f4(res.sumYDevSq)]}
          colColors={['zinc', 'emerald', 'zinc', 'emerald']}
        />
      </Panel>

      {/* ── Estadísticas Y ── */}
      <Panel title="Estadísticas de Y">
        <StatsBlock
          data={res.yData}
          sum={res.ySum}
          mean={res.yMean}
          median={res.yMedian}
          mode={res.yMode}
          sumDevSq={res.sumYDevSq}
          variance={res.yVariance}
          stdDev={res.yStdDev}
          varName="y"
        />
      </Panel>

      {/* ── Diagrama de dispersión ── */}
      <Panel title="Diagrama de Dispersión">
        <ScatterChart xData={res.xData} yData={res.yData} a={null} b={null} />
      </Panel>

      {/* ── Tabla productos cruzados ── */}
      <Panel title="Tabla de Productos Cruzados">
        <DataTable
          headers={['i', 'x', 'y', 'x − x̄', 'y − ȳ', '(x−x̄)(y−ȳ)']}
          rows={res.crossRows.map(r => [r.i, r.x, r.y, f4(r.xDev), f4(r.yDev), f4(r.cross)])}
          sumRow={['Σ', f4(res.xSum), f4(res.ySum), '0.0000', '0.0000', f4(res.sumCross)]}
          colColors={['zinc', 'blue', 'emerald', 'zinc', 'zinc', 'purple']}
        />
      </Panel>

      {/* ── Coeficiente de correlación ── */}
      <Panel title="Coeficiente de Correlación (r)">
        <div className="space-y-4">
          <FormulaBlock
            steps={[
              {
                label: 'Fórmula',
                latex: 'r = \\frac{\\sum(x - \\bar{x})(y - \\bar{y})}{(n-1) \\cdot S_x \\cdot S_y}',
              },
              {
                label: 'Sustitución',
                expr: `r = ${f4(res.sumCross)} / (${res.n - 1} · ${f2(res.xStdDev)} · ${f2(res.yStdDev)})`,
              },
              {
                label: '',
                expr: `r = ${f4(res.sumCross)} / ${f4((res.n - 1) * res.xStdDev * res.yStdDev)}`,
              },
            ]}
          />
          <ResultBadge label="r =" value={f2(res.r)} color="purple" />
          <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
            <span className="text-sm font-semibold text-purple-800">{interpretR(res.r)}</span>
          </div>
        </div>
      </Panel>

      {/* ── Valor t ── */}
      <Panel title="Valor t (prueba de significancia)">
        <div className="space-y-4">
          <FormulaBlock
            steps={[
              { label: 'Fórmula', latex: 't = \\frac{r\\sqrt{n-2}}{\\sqrt{1-r^2}}' },
              {
                label: 'Sustitución',
                expr: `t = ${f2(res.r)} · √(${res.n} − 2) / √(1 − ${f2(res.r)}²)`,
              },
              {
                label: '',
                expr: `t = ${f2(res.r)} · √${res.n - 2} / √(1 − ${f4(res.r ** 2)})`,
              },
              {
                label: '',
                expr: `t = ${f2(res.r)} · ${f4(Math.sqrt(res.n - 2))} / ${f4(Math.sqrt(1 - res.r ** 2))}`,
              },
            ]}
          />
          <ResultBadge label="t =" value={f2(res.t)} color="amber" />
        </div>
      </Panel>

      {/* ── Recta de regresión ── */}
      <Panel title="Recta de Regresión (ŷ = a + b·x)">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Pendiente b */}
            <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Pendiente b</p>
              <FormulaBlock
                steps={[
                  { label: 'Fórmula', latex: 'b = \\frac{\\sum(x - \\bar{x})(y - \\bar{y})}{\\sum(x - \\bar{x})^2}' },
                  { label: 'Sustitución', expr: `b = ${f4(res.sumCross)} / ${f4(res.sumXDevSq)}` },
                ]}
              />
              <ResultBadge label="b =" value={f2(res.b)} color="blue" />
            </div>
            {/* Intercepto a */}
            <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Intercepto a</p>
              <FormulaBlock
                steps={[
                  { label: 'Fórmula', latex: 'a = \\bar{y} - b \\cdot \\bar{x}' },
                  { label: 'Sustitución', expr: `a = ${f2(res.yMean)} − ${f2(res.b)} · ${f2(res.xMean)}` },
                  { label: '', expr: `a = ${f2(res.yMean)} − ${f4(r2(res.b) * res.xMean)}` },
                ]}
              />
              <ResultBadge label="a =" value={f2(res.a)} color="emerald" />
            </div>
          </div>

          {/* Ecuación final */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 text-center">
            <p className="text-xs text-blue-500 uppercase tracking-wide font-bold mb-1">Ecuación de regresión</p>
            <p className="text-xl font-bold font-mono text-blue-900">
              ŷ = {f2(res.a)} + {f2(res.b)}(x)
            </p>
          </div>

          {/* Fórmula de estimación */}
          <div>
            <p className="text-xs font-semibold text-zinc-600 mb-2">Fórmula de estimación</p>
            <DataTable
              headers={['i', 'x', 'Sustitución', 'ŷ']}
              rows={res.xData.map((x, i) => {
                const yHat = r4(r2(res.a) + r2(res.b) * x)
                const subs = `${f2(res.a)} + ${f2(res.b)}(${x})`
                return [i + 1, x, subs, f4(yHat)]
              })}
              sumRow={null}
              colColors={['zinc', 'blue', 'zinc', 'purple']}
            />
          </div>
        </div>
      </Panel>

      {/* ── Error de estimación Sxy ── */}
      <Panel title="Error de Estimación (Sxy)">
        <DataTable
          headers={['i', 'y', 'ŷ', 'y − ŷ', '(y − ŷ)²']}
          rows={res.errorRows.map(r => [r.i, r.y, f4(r.yHat), f4(r.res), f4(r.resSq)])}
          sumRow={['Σ', '', '', '', f4(res.sumResidualSq)]}
          colColors={['zinc', 'emerald', 'purple', 'amber', 'blue']}
        />
        <div className="space-y-3 mt-2">
          <FormulaBlock
            steps={[
              { label: 'Fórmula', latex: 'S_{xy} = \\sqrt{\\frac{\\sum(y - \\hat{y})^2}{n - 2}}' },
              { label: 'Sustitución', expr: `Sxy = √[ ${f4(res.sumResidualSq)} / (${res.n} − 2) ]` },
              { label: '', expr: `Sxy = √[ ${f4(res.sumResidualSq)} / ${res.n - 2} ] = √${f4(res.sumResidualSq / (res.n - 2))}` },
            ]}
          />
          <ResultBadge label="Sxy =" value={f2(res.sxy)} color="blue" />
        </div>
      </Panel>

      {/* ── Gráfica de correlación ── */}
      <Panel title="Gráfica de Correlación">
        <ScatterChart xData={res.xData} yData={res.yData} a={res.a} b={res.b} />
        <p className="text-xs text-zinc-400 text-center mt-2 font-mono">
          ŷ = {f2(res.a)} + {f2(res.b)}(x) &nbsp;·&nbsp; r = {f2(res.r)}
        </p>
      </Panel>

      {/* ── Intervalos ── */}
      <IntervalsPanel res={res} />

    </div>
  )
}

// ─── Intervals panel ──────────────────────────────────────────────────────────

function IntervalsPanel({ res }: { res: RegressionResult }) {
  const { n, xData, xMean, sumXDevSq, sxy, a, b, t } = res
  const a2 = r2(a), b2 = r2(b)

  const rows = xData.map((x, i) => {
    const yHat   = r4(a2 + b2 * x)
    const xDev   = r4(x - xMean)
    const xDevSq = r4(xDev ** 2)

    const inner   = r4(1 / n + xDevSq / sumXDevSq)
    const sqrtIC  = r4(Math.sqrt(inner))
    const eIC     = r4(t * sxy * sqrtIC)

    const innerP  = r4(1 + 1 / n + xDevSq / sumXDevSq)
    const sqrtIP  = r4(Math.sqrt(innerP))
    const eIP     = r4(t * sxy * sqrtIP)

    return {
      i: i + 1, x, yHat, xDevSq,
      inner, sqrtIC, eIC,
      icLI: r4(yHat - eIC), icLS: r4(yHat + eIC),
      innerP, sqrtIP, eIP,
      ipLI: r4(yHat - eIP), ipLS: r4(yHat + eIP),
    }
  })

  const tLabel = <span className="font-mono font-semibold text-zinc-700">{f2(t)}</span>

  const FormulaInfo = () => (
    <p className="text-xs text-zinc-400">
      t = {tLabel}
      &nbsp;·&nbsp; S<sub>xy</sub> = {f2(sxy)} &nbsp;·&nbsp; n = {n} &nbsp;·&nbsp; x̄ = {f4(xMean)}
      &nbsp;·&nbsp; Σ(x−x̄)² = {f4(sumXDevSq)}
    </p>
  )

  return (
    <div className="space-y-6">

      {/* ── IC para la media de Y ── */}
      <Panel title="Intervalo de Confianza para la Media de Y">
        <div className="space-y-4">
          <div className="bg-zinc-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Fórmula</p>
            <MathDisplay
              latex={`\\hat{y} \\pm t \\cdot S_{xy} \\cdot \\sqrt{\\frac{1}{n} + \\frac{(x_0 - \\bar{x})^2}{\\sum(x - \\bar{x})^2}}`}
              className="text-base"
            />
            <FormulaInfo />
          </div>

          <DataTable
            headers={['i', 'x₀', 'ŷ', '(x₀−x̄)²', 'Interior raíz', '√Interior', 't·Sxy·√', 'LI (ŷ−)', 'LS (ŷ+)']}
            rows={rows.map(r => [
              r.i, r.x, f4(r.yHat), f4(r.xDevSq),
              `1/${n} + ${f4(r.xDevSq)}/${f4(sumXDevSq)}`,
              `√${f4(r.inner)}`,
              f4(r.eIC),
              f4(r.icLI), f4(r.icLS),
            ])}
            sumRow={null}
            colColors={['zinc', 'blue', 'purple', 'zinc', 'zinc', 'zinc', 'amber', 'emerald', 'emerald']}
          />

          <div className="space-y-2">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Interpretación</p>
            {rows.map(r => (
              <div key={r.i} className="text-xs text-zinc-600 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
                <span className="font-semibold text-emerald-800">x₀ = {r.x}:</span>{' '}
                El <span className="font-semibold">promedio de Y</span> cuando X = {r.x} se
                encuentra entre{' '}
                <span className="font-mono font-semibold">ŷ − = {f4(r.icLI)}</span>{' '}y{' '}
                <span className="font-mono font-semibold">ŷ + = {f4(r.icLS)}</span>.
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* ── IP para un valor individual de Y ── */}
      <Panel title="Intervalo de Predicción para un Valor Individual de Y">
        <div className="space-y-4">
          <div className="bg-zinc-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Fórmula</p>
            <MathDisplay
              latex={`\\hat{y} \\pm t \\cdot S_{xy} \\cdot \\sqrt{1 + \\frac{1}{n} + \\frac{(x_0 - \\bar{x})^2}{\\sum(x - \\bar{x})^2}}`}
              className="text-base"
            />
            <FormulaInfo />
          </div>

          <DataTable
            headers={['i', 'x₀', 'ŷ', '(x₀−x̄)²', 'Interior raíz', '√Interior', 't·Sxy·√', 'LI (ŷ−)', 'LS (ŷ+)']}
            rows={rows.map(r => [
              r.i, r.x, f4(r.yHat), f4(r.xDevSq),
              `1 + 1/${n} + ${f4(r.xDevSq)}/${f4(sumXDevSq)}`,
              `√${f4(r.innerP)}`,
              f4(r.eIP),
              f4(r.ipLI), f4(r.ipLS),
            ])}
            sumRow={null}
            colColors={['zinc', 'blue', 'purple', 'zinc', 'zinc', 'zinc', 'amber', 'blue', 'blue']}
          />

          <div className="space-y-2">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Interpretación</p>
            {rows.map(r => (
              <div key={r.i} className="text-xs text-zinc-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                <span className="font-semibold text-blue-800">x₀ = {r.x}:</span>{' '}
                Un <span className="font-semibold">valor individual de Y</span> cuando X = {r.x} se
                encontrará entre{' '}
                <span className="font-mono font-semibold">ŷ − = {f4(r.ipLI)}</span>{' '}y{' '}
                <span className="font-mono font-semibold">ŷ + = {f4(r.ipLS)}</span>.
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            <span className="font-bold">Diferencia clave:</span> El IC estima el <em>promedio poblacional</em> de Y,
            mientras que el IP estima dónde caerá un <em>valor individual</em> futuro. Por eso el IP siempre es más amplio.
          </div>
        </div>
      </Panel>

    </div>
  )
}

// ─── Stats block (X or Y) ─────────────────────────────────────────────────────

function StatsBlock({
  data, sum, mean, median, mode, sumDevSq, variance, stdDev, varName,
}: {
  data: number[]; sum: number; mean: number; median: number; mode: number[]
  sumDevSq: number; variance: number; stdDev: number; varName: string
}) {
  const sorted = [...data].sort((a, b) => a - b)
  const modeLabel = mode.length === 0 ? 'Amodal (sin moda)' : mode.join(', ')
  const n = data.length
  const mid = Math.floor(n / 2)
  const medianExpr = n % 2 !== 0
    ? `posición ${mid + 1} → ${sorted[mid]}`
    : `(${sorted[mid - 1]} + ${sorted[mid]}) / 2 = ${median}`

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatItem label={`Σ${varName}`} value={f4(sum)} sub={`Σ${varName} = ${f4(sum)}`} />
        <StatItem label={`Σ(${varName}−${varName}̄)²`} value={f4(sumDevSq)} sub="Suma cuad. desviaciones" />
        <StatItem label={`Moda`} value={modeLabel} sub="Valor(es) más frecuentes" mono={false} />
      </div>

      {/* Media — showing sorted data */}
      <div className="bg-zinc-50 rounded-lg p-4">
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">
          Media x̄ (datos ordenados)
        </p>
        <p className="text-xs text-zinc-400 font-mono mb-1">
          Datos ordenados: {sorted.join(', ')}
        </p>
        <p className="text-xs text-zinc-500 font-mono mb-1">
          x̄ = ({sorted.join(' + ')}) / {data.length} = {f4(sum)} / {data.length}
        </p>
        <p className="text-sm font-bold font-mono text-zinc-800">x̄ = {f4(mean)}</p>
      </div>

      {/* Mediana */}
      <div className="bg-zinc-50 rounded-lg p-4">
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">
          Mediana (datos ordenados)
        </p>
        <p className="text-xs text-zinc-400 font-mono mb-1">
          Datos ordenados: {sorted.join(', ')}
        </p>
        <p className="text-xs text-zinc-500 font-mono mb-1">
          n = {n} → {n % 2 !== 0 ? 'n impar,' : 'n par,'} {medianExpr}
        </p>
        <p className="text-sm font-bold font-mono text-zinc-800">Mediana = {f4(median)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Varianza */}
        <div className="bg-zinc-50 rounded-lg p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">
            Varianza S{varName}²
          </p>
          <p className="text-xs text-zinc-500 font-mono mb-1">
            S{varName}² = Σ({varName}−{varName}̄)² / (n−1)
          </p>
          <p className="text-xs text-zinc-500 font-mono mb-1">
            S{varName}² = {f4(sumDevSq)} / {data.length - 1}
          </p>
          <p className="text-sm font-bold font-mono text-zinc-800">
            S{varName}² = {f4(variance)}
          </p>
        </div>
        {/* Desviación estándar */}
        <div className="bg-zinc-50 rounded-lg p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">
            Desv. estándar S{varName}
          </p>
          <p className="text-xs text-zinc-500 font-mono mb-1">
            S{varName} = √S{varName}²
          </p>
          <p className="text-xs text-zinc-500 font-mono mb-1">
            S{varName} = √{f4(variance)}
          </p>
          <p className="text-sm font-bold font-mono text-zinc-800">
            S{varName} = {f2(stdDev)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Scatter / regression chart ───────────────────────────────────────────────

function ScatterChart({
  xData, yData, a, b,
}: {
  xData: number[]; yData: number[]; a: number | null; b: number | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth
    const H = 280
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const pad = { top: 20, right: 20, bottom: 40, left: 52 }
    const cW = W - pad.left - pad.right
    const cH = H - pad.top - pad.bottom

    const xMin = Math.min(...xData), xMax = Math.max(...xData)
    const yMin = Math.min(...yData), yMax = Math.max(...yData)
    const xPad = (xMax - xMin) * 0.12 || 1
    const yPad = (yMax - yMin) * 0.15 || 1
    const xLo = xMin - xPad, xHi = xMax + xPad
    const yLo = yMin - yPad, yHi = yMax + yPad

    const cx = (x: number) => pad.left + ((x - xLo) / (xHi - xLo)) * cW
    const cy = (y: number) => pad.top + cH - ((y - yLo) / (yHi - yLo)) * cH

    // Grid — usar los valores reales de X e Y como ticks
    ctx.font = '10px ui-monospace, monospace'

    const uniqueX = [...new Set(xData)].sort((a, b) => a - b)
    const uniqueY = [...new Set(yData)].sort((a, b) => a - b)

    // Líneas horizontales y labels Y
    uniqueY.forEach(yv => {
      const y = cy(yv)
      ctx.strokeStyle = '#e4e4e7'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke()
      ctx.fillStyle = '#a1a1aa'
      ctx.textAlign = 'right'
      ctx.fillText(String(yv), pad.left - 5, y + 3)
    })

    // Líneas verticales y labels X
    uniqueX.forEach(xv => {
      const x = cx(xv)
      ctx.strokeStyle = '#e4e4e7'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, H - pad.bottom); ctx.stroke()
      ctx.fillStyle = '#a1a1aa'
      ctx.textAlign = 'center'
      ctx.fillText(String(xv), x, H - pad.bottom + 14)
    })

    // Axis labels
    ctx.fillStyle = '#71717a'
    ctx.font = 'italic 11px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('x', W / 2, H - 4)
    ctx.save()
    ctx.translate(12, pad.top + cH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('y', 0, 0)
    ctx.restore()

    // Regression line
    if (a !== null && b !== null) {
      const x1 = xLo, x2 = xHi
      const y1 = a + b * x1, y2 = a + b * x2
      ctx.beginPath()
      ctx.moveTo(cx(x1), cy(y1))
      ctx.lineTo(cx(x2), cy(y2))
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Data points
    xData.forEach((x, i) => {
      const y = yData[i]
      ctx.beginPath()
      ctx.arc(cx(x), cy(y), 5, 0, Math.PI * 2)
      ctx.fillStyle = a !== null ? '#10b981' : '#6366f1'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })
  }, [xData, yData, a, b])

  return <canvas ref={canvasRef} className="w-full rounded" style={{ height: 280 }} />
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type ColColor = 'zinc' | 'blue' | 'emerald' | 'purple' | 'amber'

const COL_COLORS: Record<ColColor, string> = {
  zinc:    'text-zinc-700',
  blue:    'text-blue-700',
  emerald: 'text-emerald-700',
  purple:  'text-purple-700',
  amber:   'text-amber-700',
}

function DataTable({
  headers, rows, sumRow, colColors,
}: {
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
                <td key={ci} className={`px-3 py-1.5 ${COL_COLORS[colColors[ci] ?? 'zinc']}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {sumRow && (
            <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold">
              {sumRow.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2 ${COL_COLORS[colColors[ci] ?? 'zinc']}`}>
                  {cell}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function FormulaBlock({ steps }: { steps: { label: string; expr?: string; latex?: string }[] }) {
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-3 items-center text-xs">
          {s.label && (
            <span className="text-zinc-400 font-bold uppercase text-[10px] w-20 shrink-0">
              {s.label}
            </span>
          )}
          {s.latex
            ? <MathDisplay latex={s.latex} className="text-sm" />
            : <span className="font-mono text-zinc-600 italic">{s.expr ?? ''}</span>
          }
        </div>
      ))}
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

function StatItem({ label, value, sub, mono = true }: { label: string; value: string; sub: string; mono?: boolean }) {
  return (
    <div className="bg-zinc-50 rounded-lg p-3">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className={`text-base font-semibold text-zinc-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={14} className="text-zinc-400" />
        <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">{title}</p>
      </div>
      {children}
    </div>
  )
}

function interpretR(r: number): string {
  const a = Math.abs(r)
  const dir = r > 0 ? 'positiva' : 'negativa'
  if (a >= 0.9)  return `Correlación ${dir} muy fuerte (r = ${r.toFixed(2)})`
  if (a >= 0.7)  return `Correlación ${dir} fuerte (r = ${r.toFixed(2)})`
  if (a >= 0.5)  return `Correlación ${dir} moderada (r = ${r.toFixed(2)})`
  if (a >= 0.3)  return `Correlación ${dir} débil (r = ${r.toFixed(2)})`
  return `Correlación ${dir} muy débil o inexistente (r = ${r.toFixed(2)})`
}
