import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Calculator, TrendingUp } from 'lucide-react'
import { Button } from '../../components/ui/Button'

// ─── Math helpers ─────────────────────────────────────────────────────────────

function r4(x: number): number { return Math.round(x * 10000) / 10000 }
function r2(x: number): number { return Math.round(x * 100) / 100 }
function f4(x: number): string { return parseFloat(x.toFixed(4)).toString() }
function f2(x: number): string { return parseFloat(x.toFixed(2)).toString() }

function calcMean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length
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
  xMode: number[]; yMode: number[]
  xRows: { i: number; x: number; dev: number; devSq: number }[]
  yRows: { i: number; y: number; dev: number; devSq: number }[]
  crossRows: { i: number; x: number; y: number; xDev: number; yDev: number; cross: number }[]
  sumXDevSq: number; sumYDevSq: number; sumCross: number
  xVariance: number; yVariance: number
  xStdDev: number; yStdDev: number
  r: number; t: number
  b: number; a: number
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

  const rRaw = sumCross / Math.sqrt(sumXDevSq * sumYDevSq)
  const r = r2(rRaw)
  const t = r2(rRaw * Math.sqrt(n - 2) / Math.sqrt(1 - rRaw ** 2))

  const b = r4(sumCross / sumXDevSq)
  const a = r4(yMean - b * xMean)

  return {
    n, xData, yData, xSum, ySum,
    xMean: r4(xMean), yMean: r4(yMean),
    xMode: calcMode(xData), yMode: calcMode(yData),
    xRows, yRows, crossRows,
    sumXDevSq, sumYDevSq, sumCross,
    xVariance, yVariance, xStdDev, yStdDev,
    r, t, b, a,
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function LinearRegressionPage() {
  const [rows, setRows] = useState<DataRow[]>(
    Array.from({ length: 6 }, () => ({ x: '', y: '' }))
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
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Regresión Lineal</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Ingresa los datos para calcular la recta de regresión&nbsp;
          <span className="font-mono italic">ŷ = a + b(x)</span>
        </p>
      </div>

      {/* ── Input ── */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Datos</p>
          <Button onClick={addRow} variant="secondary" size="sm">
            <Plus size={13} /> Agregar fila
          </Button>
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
                expr: 'r = Σ(x − x̄)(y − ȳ) / √[ Σ(x − x̄)² · Σ(y − ȳ)² ]',
              },
              {
                label: 'Sustitución',
                expr: `r = ${f4(res.sumCross)} / √[ ${f4(res.sumXDevSq)} · ${f4(res.sumYDevSq)} ]`,
              },
              {
                label: 'Raíz',
                expr: `√[ ${f4(res.sumXDevSq * res.sumYDevSq)} ] = ${f4(Math.sqrt(res.sumXDevSq * res.sumYDevSq))}`,
              },
            ]}
          />
          <ResultBadge label="r =" value={f2(res.r)} color="purple" />
          <p className="text-xs text-zinc-500">{interpretR(res.r)}</p>
        </div>
      </Panel>

      {/* ── Valor t ── */}
      <Panel title="Valor t (prueba de significancia)">
        <div className="space-y-4">
          <FormulaBlock
            steps={[
              { label: 'Fórmula', expr: 't = r · √(n − 2) / √(1 − r²)' },
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
                  { label: 'Fórmula', expr: 'b = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)²' },
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
                  { label: 'Fórmula', expr: 'a = ȳ − b · x̄' },
                  { label: 'Sustitución', expr: `a = ${f4(res.yMean)} − ${f4(res.b)} · ${f4(res.xMean)}` },
                  { label: '', expr: `a = ${f4(res.yMean)} − ${f4(res.b * res.xMean)}` },
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

          {/* Tabla de valores estimados */}
          <div>
            <p className="text-xs font-semibold text-zinc-600 mb-2">Valores estimados ŷ</p>
            <DataTable
              headers={['i', 'x', 'y', 'ŷ = a + b(x)', 'y − ŷ']}
              rows={res.xData.map((x, i) => {
                const yHat = r4(res.a + res.b * x)
                const residual = r4(res.yData[i] - yHat)
                return [i + 1, x, res.yData[i], f4(yHat), f4(residual)]
              })}
              sumRow={null}
              colColors={['zinc', 'blue', 'emerald', 'purple', 'amber']}
            />
          </div>
        </div>
      </Panel>

      {/* ── Gráfica de correlación ── */}
      <Panel title="Gráfica de Correlación">
        <ScatterChart xData={res.xData} yData={res.yData} a={res.a} b={res.b} />
        <p className="text-xs text-zinc-400 text-center mt-2 font-mono">
          ŷ = {f2(res.a)} + {f2(res.b)}(x) &nbsp;·&nbsp; r = {f2(res.r)}
        </p>
      </Panel>

    </div>
  )
}

// ─── Stats block (X or Y) ─────────────────────────────────────────────────────

function StatsBlock({
  data, sum, mean, mode, sumDevSq, variance, stdDev, varName,
}: {
  data: number[]; sum: number; mean: number; mode: number[]
  sumDevSq: number; variance: number; stdDev: number; varName: string
}) {
  const sorted = [...data].sort((a, b) => a - b)
  const modeLabel = mode.length === 0 ? 'Amodal (sin moda)' : mode.join(', ')

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

    // Grid
    ctx.strokeStyle = '#e4e4e7'
    ctx.lineWidth = 1
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillStyle = '#a1a1aa'
    const gridN = 5
    for (let i = 0; i <= gridN; i++) {
      const yv = yLo + ((yHi - yLo) / gridN) * i
      const y = cy(yv)
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke()
      ctx.textAlign = 'right'
      ctx.fillText(r4(yv).toFixed(1), pad.left - 5, y + 3)
    }
    for (let i = 0; i <= gridN; i++) {
      const xv = xLo + ((xHi - xLo) / gridN) * i
      const x = cx(xv)
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, H - pad.bottom); ctx.stroke()
      ctx.textAlign = 'center'
      ctx.fillText(r4(xv).toFixed(1), x, H - pad.bottom + 14)
    }

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

function FormulaBlock({ steps }: { steps: { label: string; expr: string }[] }) {
  return (
    <div className="space-y-1">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-3 text-xs">
          {s.label && (
            <span className="text-zinc-400 font-bold uppercase text-[10px] w-20 shrink-0 pt-0.5">
              {s.label}
            </span>
          )}
          <span className="font-mono text-zinc-600 italic">{s.expr}</span>
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
