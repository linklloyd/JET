import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ChevronDown, ChevronRight, Plus, Trash2, Calculator } from 'lucide-react'
import {
  binomialBase,
  poissonBase,
  hypergeometricDual,
  normalBase,
  tStudentBase,
  chiSquareBase,
  fisherBase,
  evaluateInciso,
  evaluateIncisoRange,
  evaluateIncisoContinuous,
  evaluateIncisoContinuousRange,
  type DistBaseResult,
  type ContinuousResult,
  type HyperDualResult,
  type TableRow,
  type Operator,
  type RangeOp,
  type IncisoResult,
} from './distributions'

type DistType = 'binomial' | 'poisson' | 'hypergeometric' | 'normal' | 'tstudent' | 'chi-square' | 'fisher'

interface Inciso {
  mode: 'single' | 'range'
  operator: Operator
  value: string
  // Range mode fields
  lowValue: string
  opLow: RangeOp
  opHigh: RangeOp
  highValue: string
  result: IncisoResult | null
}

const DIST_DESCRIPTIONS: Record<DistType, string> = {
  binomial: 'Probabilidad de k éxitos en n ensayos independientes',
  poisson: 'Probabilidad de eventos en un intervalo basado en λ',
  hypergeometric: 'Probabilidad sin reemplazo (selección de subconjuntos)',
  normal: 'Distribución continua simétrica (campana de Gauss)',
  tstudent: 'Distribución para muestras pequeñas con varianza desconocida',
  'chi-square': 'Distribución para pruebas de bondad de ajuste e independencia',
  fisher: 'Distribución para comparar varianzas de dos poblaciones',
}

const OPERATORS: { value: Operator; label: string }[] = [
  { value: '=', label: 'X =' },
  { value: '>', label: 'X >' },
  { value: '<', label: 'X <' },
  { value: '>=', label: 'X ≥' },
  { value: '<=', label: 'X ≤' },
  { value: '!=', label: 'X ≠' },
]


const INCISO_LETTERS = 'abcdefghijklmnopqrstuvwxyz'

const DIST_TITLES: Record<DistType, string> = {
  binomial: 'Distribución Binomial',
  poisson: 'Distribución de Poisson',
  hypergeometric: 'Distribución Hipergeométrica',
  normal: 'Distribución Normal',
  tstudent: 'Distribución T-Student',
  'chi-square': 'Distribución Chi-Cuadrada (χ²)',
  fisher: 'Distribución F de Fisher',
}

export function ProbabilityPage() {
  const { distType: urlDistType } = useParams<{ distType: string }>()
  const distType = (
    ['binomial', 'poisson', 'hypergeometric', 'normal', 'tstudent', 'chi-square', 'fisher'].includes(urlDistType ?? '')
      ? urlDistType
      : 'binomial'
  ) as DistType

  const [base, setBase] = useState<DistBaseResult | null>(null)
  const [incisos, setIncisos] = useState<Inciso[]>([])
  const [tableOpen, setTableOpen] = useState(true)

  // Hypergeometric dual state
  const [hyperDual, setHyperDual] = useState<HyperDualResult | null>(null)
  const [hyperIncisosSuc, setHyperIncisosSuc] = useState<Inciso[]>([])
  const [hyperIncisosFail, setHyperIncisosFail] = useState<Inciso[]>([])
  const [hypSuccessLabel, setHypSuccessLabel] = useState('Éxitos')
  const [hypFailureLabel, setHypFailureLabel] = useState('Fracasos')
  const [tableOpenSuc, setTableOpenSuc] = useState(true)
  const [tableOpenFail, setTableOpenFail] = useState(true)

  // Binomial params
  const [binN, setBinN] = useState('10')
  const [binP, setBinP] = useState('0.5')

  // Poisson params
  const [poisLambda, setPoisLambda] = useState('4')

  // Hypergeometric params
  const [hypN, setHypN] = useState('50')
  const [hypK, setHypK] = useState('10')
  const [hypn, setHypn] = useState('5')

  // Normal params
  const [normMu, setNormMu] = useState('0')
  const [normSigma, setNormSigma] = useState('1')

  // T-Student params
  const [tDf, setTDf] = useState('10')

  // Chi-Square params
  const [chiK, setChiK] = useState('5')

  // Fisher params
  const [fishD1, setFishD1] = useState('5')
  const [fishD2, setFishD2] = useState('10')

  // Continuous result (for normal, t-student, chi-square, fisher)
  const [contResult, setContResult] = useState<ContinuousResult | null>(null)

  // Reset when distribution type changes via URL
  useEffect(() => {
    setBase(null)
    setContResult(null)
    setHyperDual(null)
    setIncisos([])
    setHyperIncisosSuc([])
    setHyperIncisosFail([])
    setTableOpen(true)
    setTableOpenSuc(true)
    setTableOpenFail(true)
  }, [distType])

  const isContinuous = ['normal', 'tstudent', 'chi-square', 'fisher'].includes(distType)

  const calculate = useCallback(() => {
    if (distType === 'hypergeometric') {
      const dual = hypergeometricDual(+hypN, +hypK, +hypn)
      setHyperDual(dual)
      setBase(null)
      setContResult(null)
      setHyperIncisosSuc([])
      setHyperIncisosFail([])
    } else if (isContinuous) {
      let r: ContinuousResult
      switch (distType) {
        case 'normal':
          r = normalBase(+normMu, +normSigma)
          break
        case 'tstudent':
          r = tStudentBase(+tDf)
          break
        case 'chi-square':
          r = chiSquareBase(+chiK)
          break
        case 'fisher':
          r = fisherBase(+fishD1, +fishD2)
          break
        default:
          r = normalBase(0, 1)
      }
      setContResult(r)
      setBase(null)
      setHyperDual(null)
      setIncisos([])
    } else {
      let r: DistBaseResult
      switch (distType) {
        case 'binomial':
          r = binomialBase(+binN, +binP)
          break
        case 'poisson':
          r = poissonBase(+poisLambda)
          break
        default:
          r = binomialBase(+binN, +binP)
      }
      setBase(r)
      setContResult(null)
      setHyperDual(null)
      setIncisos([])
    }
    setTableOpen(true)
    setTableOpenSuc(true)
    setTableOpenFail(true)
  }, [distType, binN, binP, poisLambda, hypN, hypK, hypn, normMu, normSigma, tDf, chiK, fishD1, fishD2, isContinuous])

  // ─── Inciso management (generic) ──────────────────────────────────────

  const autoCalc = (inc: Inciso, table: TableRow[], cdf?: (x: number) => number): IncisoResult => {
    if (cdf) {
      // Continuous distribution
      if (inc.mode === 'range') {
        return evaluateIncisoContinuousRange(cdf, +inc.lowValue, inc.opLow, inc.opHigh, +inc.highValue)
      }
      return evaluateIncisoContinuous(cdf, inc.operator, +inc.value)
    }
    if (inc.mode === 'range') {
      return evaluateIncisoRange(table, +inc.lowValue, inc.opLow, inc.opHigh, +inc.highValue)
    }
    return evaluateInciso(table, inc.operator, +inc.value)
  }

  const makeIncisoHandlers = (
    list: Inciso[],
    setList: React.Dispatch<React.SetStateAction<Inciso[]>>,
    table: TableRow[],
    cdf?: (x: number) => number,
  ) => ({
    add: () => {
      const newInc: Inciso = {
        mode: 'single', operator: '=' as Operator, value: '0',
        lowValue: '0', opLow: '<', opHigh: '<', highValue: '5',
        result: null,
      }
      newInc.result = autoCalc(newInc, table, cdf)
      setList([...list, newInc])
    },
    remove: (idx: number) => setList(list.filter((_, i) => i !== idx)),
    update: (idx: number, field: string, val: string) => {
      const next = [...list]
      const updated = { ...next[idx], [field]: val }
      updated.result = autoCalc(updated, table, cdf)
      next[idx] = updated
      setList(next)
    },
    toggleMode: (idx: number) => {
      const next = [...list]
      const inc = { ...next[idx] }
      inc.mode = inc.mode === 'single' ? 'range' : 'single'
      inc.result = autoCalc(inc, table, cdf)
      next[idx] = inc
      setList(next)
    },
  })

  // Highlighted x values from incisos
  const getHighlightXs = (incList: Inciso[]) => {
    const set = new Set<number>()
    for (const inc of incList) {
      if (inc.result) {
        for (const row of inc.result.matchingRows) set.add(row.x)
      }
    }
    return set
  }

  const highlightXs = getHighlightXs(incisos)
  const highlightXsSuc = getHighlightXs(hyperIncisosSuc)
  const highlightXsFail = getHighlightXs(hyperIncisosFail)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">{DIST_TITLES[distType]}</h2>
        <p className="text-sm text-zinc-500 mt-2">{DIST_DESCRIPTIONS[distType]}</p>
      </div>

      {/* Parameters card */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
        <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Parámetros</p>

        {distType === 'binomial' && (
          <div className="grid grid-cols-2 gap-4">
            <InputField label={<>n <M>(ensayos)</M></>} value={binN} onChange={setBinN} min={1} max={170} step={1} />
            <InputField label={<>p <M>(probabilidad)</M></>} value={binP} onChange={setBinP} min={0} max={1} step={0.01} />
          </div>
        )}

        {distType === 'poisson' && (
          <div className="grid grid-cols-1 gap-4 max-w-xs">
            <InputField label={<>λ <M>(media esperada)</M></>} value={poisLambda} onChange={setPoisLambda} min={0.01} step={0.1} />
          </div>
        )}

        {distType === 'hypergeometric' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <InputField label={<>N <M>(población total)</M></>} value={hypN} onChange={setHypN} min={1} step={1} />
              <InputField label={<>K <M>(éxitos en población)</M></>} value={hypK} onChange={setHypK} min={0} max={+hypN} step={1} />
              <InputField label={<>n <M>(muestra)</M></>} value={hypn} onChange={setHypn} min={1} max={+hypN} step={1} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="block text-xs font-medium text-zinc-600">Etiqueta éxitos <span className="text-zinc-400">(K = {hypK})</span></span>
                <input
                  type="text"
                  value={hypSuccessLabel}
                  onChange={(e) => setHypSuccessLabel(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  placeholder="Ej: Mujeres"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-xs font-medium text-zinc-600">Etiqueta fracasos <span className="text-zinc-400">(N−K = {+hypN - +hypK})</span></span>
                <input
                  type="text"
                  value={hypFailureLabel}
                  onChange={(e) => setHypFailureLabel(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  placeholder="Ej: Hombres"
                />
              </label>
            </div>
          </div>
        )}

        {distType === 'normal' && (
          <div className="grid grid-cols-2 gap-4">
            <InputField label={<>μ <M>(media)</M></>} value={normMu} onChange={setNormMu} step={0.1} />
            <InputField label={<>σ <M>(desviación estándar)</M></>} value={normSigma} onChange={setNormSigma} min={0.01} step={0.1} />
          </div>
        )}

        {distType === 'tstudent' && (
          <div className="grid grid-cols-1 gap-4 max-w-xs">
            <InputField label={<>ν <M>(grados de libertad)</M></>} value={tDf} onChange={setTDf} min={1} step={1} />
          </div>
        )}

        {distType === 'chi-square' && (
          <div className="grid grid-cols-1 gap-4 max-w-xs">
            <InputField label={<>k <M>(grados de libertad)</M></>} value={chiK} onChange={setChiK} min={1} step={1} />
          </div>
        )}

        {distType === 'fisher' && (
          <div className="grid grid-cols-2 gap-4">
            <InputField label={<>d₁ <M>(grados de libertad numerador)</M></>} value={fishD1} onChange={setFishD1} min={1} step={1} />
            <InputField label={<>d₂ <M>(grados de libertad denominador)</M></>} value={fishD2} onChange={setFishD2} min={1} step={1} />
          </div>
        )}

        <Button onClick={calculate} variant="primary" size="md">
          <Calculator size={14} /> Calcular
        </Button>
      </div>

      {/* ═══════════ RESULTS — discrete non-hypergeometric ═══════════ */}
      {base && !isContinuous && distType !== 'hypergeometric' && (
        <DistPanel
          base={base}
          incisos={incisos}
          handlers={makeIncisoHandlers(incisos, setIncisos, base.table)}
          highlightXs={highlightXs}
          tableOpen={tableOpen}
          setTableOpen={setTableOpen}
          formulaFn={
            distType === 'binomial'
              ? (x: number) => `C(${binN},${x}) · ${binP}^${x} · ${(1 - +binP).toFixed(4)}^${+binN - x}`
              : distType === 'poisson'
              ? (x: number) => `(${poisLambda}^${x} · e^-${poisLambda}) / ${x}!`
              : undefined
          }
        />
      )}

      {/* ═══════════ RESULTS — continuous ═══════════ */}
      {contResult && isContinuous && (
        <DistPanel
          base={contResult}
          incisos={incisos}
          handlers={makeIncisoHandlers(incisos, setIncisos, contResult.table, contResult.cdf)}
          highlightXs={highlightXs}
          tableOpen={tableOpen}
          setTableOpen={setTableOpen}
          isContinuous
          pdfLabel={
            distType === 'normal' ? 'f(x)' :
            distType === 'tstudent' ? 'f(t)' :
            distType === 'chi-square' ? 'f(χ²)' :
            'f(x)'
          }
        />
      )}

      {/* ═══════════ RESULTS — hypergeometric dual ═══════════ */}
      {hyperDual && distType === 'hypergeometric' && (
        <div className="space-y-6">
          {/* ── Success distribution ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="text-lg font-bold text-zinc-800">{hypSuccessLabel}</h3>
              <span className="text-sm text-zinc-400 font-mono">K = {hypK}</span>
            </div>
            <DistPanel
              base={hyperDual.success}
              incisos={hyperIncisosSuc}
              handlers={makeIncisoHandlers(hyperIncisosSuc, setHyperIncisosSuc, hyperDual.success.table)}
              highlightXs={highlightXsSuc}
              tableOpen={tableOpenSuc}
              setTableOpen={setTableOpenSuc}
              formulaFn={(x: number) => `C(${hypK},${x}) · C(${+hypN - +hypK},${+hypn - x}) / C(${hypN},${hypn})`}
            />
          </div>

          <hr className="border-zinc-200" />

          {/* ── Failure distribution ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
              <h3 className="text-lg font-bold text-zinc-800">{hypFailureLabel}</h3>
              <span className="text-sm text-zinc-400 font-mono">N−K = {+hypN - +hypK}</span>
            </div>
            <DistPanel
              base={hyperDual.failure}
              incisos={hyperIncisosFail}
              handlers={makeIncisoHandlers(hyperIncisosFail, setHyperIncisosFail, hyperDual.failure.table)}
              highlightXs={highlightXsFail}
              tableOpen={tableOpenFail}
              setTableOpen={setTableOpenFail}
              color="amber"
              formulaFn={(x: number) => `C(${+hypN - +hypK},${x}) · C(${hypK},${+hypn - x}) / C(${hypN},${hypn})`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Distribution panel (reusable for each distribution result) ─────────

interface IncisoHandlers {
  add: () => void
  remove: (idx: number) => void
  update: (idx: number, field: string, val: string) => void
  toggleMode: (idx: number) => void
}

type ChartColor = 'blue' | 'amber'

function DistPanel({
  base, incisos, handlers, highlightXs, tableOpen, setTableOpen, color = 'blue', formulaFn, isContinuous: continuous, pdfLabel,
}: {
  base: DistBaseResult | ContinuousResult
  incisos: Inciso[]
  handlers: IncisoHandlers
  highlightXs: Set<number>
  tableOpen: boolean
  setTableOpen: (v: boolean) => void
  color?: ChartColor
  formulaFn?: (x: number) => string
  isContinuous?: boolean
  pdfLabel?: string
}) {
  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4">
        <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-3">Estadísticas</p>
        <div className="grid grid-cols-3 gap-4">
          <StatItem label="Media (μ)" value={base.mean.toFixed(2)} formula={base.meanFormula} />
          <StatItem label="Varianza (σ²)" value={base.variance.toFixed(2)} formula={base.varianceFormula} />
          <StatItem label="Desv. estándar (σ)" value={base.stdDev.toFixed(2)} formula={base.stdDevFormula} />
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4">
        <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-3">Gráfico de distribución</p>
        {continuous ? (
          <ContinuousChart table={base.table} color={color} yLabel={pdfLabel || 'f(x)'} />
        ) : (
          <DistChart table={base.table} highlightXs={highlightXs} color={color} />
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-lg">
        <button onClick={() => setTableOpen(!tableOpen)} className="w-full flex items-center gap-2 p-4 text-left">
          {tableOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Tabla de distribución</p>
        </button>
        {tableOpen && (
          <div className="px-4 pb-4">
            <DistTable table={base.table} highlightXs={highlightXs} formulaFn={formulaFn} isContinuous={continuous} pdfLabel={pdfLabel} />
          </div>
        )}
      </div>

      {/* Incisos */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Incisos</p>
          <Button onClick={handlers.add} variant="secondary" size="sm">
            <Plus size={12} /> Agregar inciso
          </Button>
        </div>

        {incisos.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-4">
            Agrega incisos para calcular probabilidades específicas, por ejemplo: <M>P(X {'>'} 2)</M>, <M>P(X = 5)</M>, <M>P(X {'≤'} 3)</M>
          </p>
        )}

        {incisos.map((inc, idx) => (
          <IncisoRow key={idx} inc={inc} idx={idx} handlers={handlers} />
        ))}
      </div>
    </div>
  )
}

// ─── Inciso row with auto-calc and desglose toggle ──────────────────────

const RANGE_OPS: { value: RangeOp; label: string }[] = [
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
]

function IncisoRow({ inc, idx, handlers }: { inc: Inciso; idx: number; handlers: IncisoHandlers }) {
  const [showSteps, setShowSteps] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-blue-600 w-8 shrink-0">
          {INCISO_LETTERS[idx]})
        </span>

        {/* Mode toggle */}
        <button
          onClick={() => handlers.toggleMode(idx)}
          className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors shrink-0"
          title={inc.mode === 'single' ? 'Cambiar a rango' : 'Cambiar a simple'}
        >
          {inc.mode === 'single' ? 'a..b' : 'X=k'}
        </button>

        <span className="text-sm text-zinc-500 font-serif italic">P(</span>

        {inc.mode === 'single' ? (
          /* ── Single mode ── */
          <>
            <select
              value={inc.operator}
              onChange={(e) => handlers.update(idx, 'operator', e.target.value)}
              className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={inc.value}
              onChange={(e) => handlers.update(idx, 'value', e.target.value)}
              className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              min={0}
              step={1}
            />
          </>
        ) : (
          /* ── Range mode: [lowValue] [opLow] X [opHigh] [highValue] ── */
          <>
            <input
              type="number"
              value={inc.lowValue}
              onChange={(e) => handlers.update(idx, 'lowValue', e.target.value)}
              className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              step={1}
            />
            <select
              value={inc.opLow}
              onChange={(e) => handlers.update(idx, 'opLow', e.target.value)}
              className="rounded-lg border border-zinc-200 px-1.5 py-1.5 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            >
              {RANGE_OPS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <span className="text-sm font-mono font-medium text-zinc-700">X</span>
            <select
              value={inc.opHigh}
              onChange={(e) => handlers.update(idx, 'opHigh', e.target.value)}
              className="rounded-lg border border-zinc-200 px-1.5 py-1.5 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            >
              {RANGE_OPS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={inc.highValue}
              onChange={(e) => handlers.update(idx, 'highValue', e.target.value)}
              className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              step={1}
            />
          </>
        )}

        <span className="text-sm text-zinc-500 font-serif italic">)</span>

        {/* Inline result */}
        {inc.result && (
          <>
            <span className="text-sm text-zinc-400 mx-1">=</span>
            <span className="text-sm font-bold font-mono text-zinc-900">{inc.result.probability.toFixed(4)}</span>
            <span className="text-xs text-zinc-400 font-mono">({(inc.result.probability * 100).toFixed(2)}%)</span>
          </>
        )}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {inc.result && (
            <button
              onClick={() => setShowSteps(!showSteps)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                showSteps ? 'bg-blue-100 text-blue-700' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
              }`}
            >
              {showSteps ? 'Ocultar' : 'Desglose'}
            </button>
          )}
          <button
            onClick={() => handlers.remove(idx)}
            className="text-zinc-300 hover:text-red-500 transition-colors"
            title="Eliminar inciso"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {inc.result && showSteps && (
        <div className="ml-8 space-y-1">
          {inc.result.steps.map((step, si) => (
            <div key={si} className="flex items-start gap-3 py-1 text-xs">
              <span className="font-bold text-zinc-400 uppercase w-28 shrink-0 pt-0.5 text-[10px]">
                {step.label}
              </span>
              <span className="font-mono text-zinc-600 flex-1"><M>{step.expression}</M></span>
              {step.value && (
                <span className="font-mono font-medium text-zinc-900">= {step.value}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

function M({ children }: { children: React.ReactNode }) {
  return <span className="italic font-serif">{children}</span>
}

function InputField({
  label, value, onChange, min, max, step,
}: {
  label: React.ReactNode; value: string; onChange: (v: string) => void
  min?: number; max?: number; step?: number
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs font-medium text-zinc-600">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min} max={max} step={step}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      />
    </label>
  )
}

function StatItem({ label, value, formula }: { label: string; value: string; formula: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-base font-mono font-semibold text-zinc-800">{value}</p>
      <p className="text-[11px] font-mono text-zinc-400 mt-0.5 italic">{formula}</p>
    </div>
  )
}

function DistTable({ table, highlightXs, formulaFn, isContinuous, pdfLabel }: {
  table: TableRow[]; highlightXs: Set<number>; formulaFn?: (x: number) => string
  isContinuous?: boolean; pdfLabel?: string
}) {
  return (
    <div className="max-h-80 overflow-y-auto rounded border border-zinc-100">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-zinc-50 z-10">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-zinc-600 border-b border-zinc-200"><M>x</M></th>
            {formulaFn && (
              <th className="text-left px-3 py-2 font-medium text-zinc-600 border-b border-zinc-200">Fórmula</th>
            )}
            <th className="text-right px-3 py-2 font-medium text-zinc-600 border-b border-zinc-200">
              <M>{isContinuous ? (pdfLabel || 'f(x)') : 'P(X = x)'}</M>
            </th>
            <th className="text-right px-3 py-2 font-medium text-zinc-600 border-b border-zinc-200">
              <M>{isContinuous ? 'F(x)' : 'P(X ≤ x)'}</M>
            </th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr key={i} className={highlightXs.has(row.x) ? 'bg-blue-50 font-medium' : 'hover:bg-zinc-50'}>
              <td className="px-3 py-1.5 border-b border-zinc-100 font-mono">{row.x}</td>
              {formulaFn && (
                <td className="px-3 py-1.5 border-b border-zinc-100 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                  {formulaFn(row.x)}
                </td>
              )}
              <td className="px-3 py-1.5 border-b border-zinc-100 text-right font-mono">{row.px.toFixed(6)}</td>
              <td className="px-3 py-1.5 border-b border-zinc-100 text-right font-mono">{row.cumulative.toFixed(6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Bar chart ──────────────────────────────────────────────────────────

const CHART_COLORS: Record<ChartColor, { bar: string; highlight: string; labelHighlight: string }> = {
  blue: { bar: '#bfdbfe', highlight: '#3b82f6', labelHighlight: '#1d4ed8' },
  amber: { bar: '#fde68a', highlight: '#f59e0b', labelHighlight: '#b45309' },
}

function DistChart({ table, highlightXs, color = 'blue' }: { table: TableRow[]; highlightXs: Set<number>; color?: ChartColor }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || table.length === 0) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = 220
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const maxP = Math.max(...table.map((r) => r.px), 0.001)
    const pad = { top: 16, bottom: 32, left: 48, right: 16 }
    const chartW = w - pad.left - pad.right
    const chartH = h - pad.top - pad.bottom

    const barCount = table.length
    const gap = Math.max(1, Math.min(3, Math.floor(chartW / barCount * 0.15)))
    const barW = Math.max(2, (chartW - gap * (barCount - 1)) / barCount)

    // Y-axis gridlines
    ctx.strokeStyle = '#e4e4e7'
    ctx.lineWidth = 1
    const yTicks = 5
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillStyle = '#a1a1aa'
    ctx.textAlign = 'right'
    for (let i = 0; i <= yTicks; i++) {
      const yVal = (maxP / yTicks) * i
      const y = pad.top + chartH - (chartH * yVal) / maxP
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
      ctx.fillText(yVal.toFixed(3), pad.left - 6, y + 3)
    }

    // Bars
    table.forEach((row, i) => {
      const x = pad.left + i * (barW + gap)
      const barH = (row.px / maxP) * chartH
      const y = pad.top + chartH - barH

      const isHighlight = highlightXs.has(row.x)
      const cc = CHART_COLORS[color]
      ctx.fillStyle = isHighlight ? cc.highlight : cc.bar
      ctx.beginPath()
      ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0])
      ctx.fill()

      const labelStep = barCount > 30 ? Math.ceil(barCount / 15) : 1
      if (i % labelStep === 0 || isHighlight) {
        ctx.fillStyle = isHighlight ? cc.labelHighlight : '#71717a'
        ctx.font = isHighlight ? 'bold 10px ui-monospace, monospace' : '10px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(String(row.x), x + barW / 2, h - pad.bottom + 14)
      }
    })

    // Axis labels
    ctx.fillStyle = '#a1a1aa'
    ctx.font = 'italic 11px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('x', w / 2, h - 2)
    ctx.save()
    ctx.translate(12, pad.top + chartH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('P(X = x)', 0, 0)
    ctx.restore()
  }, [table, highlightXs])

  return <canvas ref={canvasRef} className="w-full" style={{ height: 220 }} />
}

// ─── Continuous curve chart ──────────────────────────────────────────────

function ContinuousChart({ table, color = 'blue', yLabel }: { table: TableRow[]; color?: ChartColor; yLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || table.length === 0) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = 220
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const maxP = Math.max(...table.map((r) => r.px), 0.001) * 1.1
    const minX = table[0].x
    const maxX = table[table.length - 1].x
    const pad = { top: 16, bottom: 32, left: 48, right: 16 }
    const chartW = w - pad.left - pad.right
    const chartH = h - pad.top - pad.bottom

    const toCanvasX = (x: number) => pad.left + ((x - minX) / (maxX - minX)) * chartW
    const toCanvasY = (y: number) => pad.top + chartH - (y / maxP) * chartH

    // Y-axis gridlines
    ctx.strokeStyle = '#e4e4e7'
    ctx.lineWidth = 1
    const yTicks = 5
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillStyle = '#a1a1aa'
    ctx.textAlign = 'right'
    for (let i = 0; i <= yTicks; i++) {
      const yVal = (maxP / yTicks) * i
      const y = toCanvasY(yVal)
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
      ctx.fillText(yVal.toFixed(3), pad.left - 6, y + 3)
    }

    // X-axis labels
    ctx.textAlign = 'center'
    const xTicks = 8
    for (let i = 0; i <= xTicks; i++) {
      const xVal = minX + ((maxX - minX) / xTicks) * i
      const x = toCanvasX(xVal)
      ctx.fillText(xVal.toFixed(1), x, h - pad.bottom + 14)
    }

    // Fill area under curve
    const cc = CHART_COLORS[color]
    ctx.beginPath()
    ctx.moveTo(toCanvasX(table[0].x), toCanvasY(0))
    for (const row of table) {
      ctx.lineTo(toCanvasX(row.x), toCanvasY(row.px))
    }
    ctx.lineTo(toCanvasX(table[table.length - 1].x), toCanvasY(0))
    ctx.closePath()
    ctx.fillStyle = cc.bar + '80' // semi-transparent
    ctx.fill()

    // Draw curve line
    ctx.beginPath()
    ctx.moveTo(toCanvasX(table[0].x), toCanvasY(table[0].px))
    for (const row of table) {
      ctx.lineTo(toCanvasX(row.x), toCanvasY(row.px))
    }
    ctx.strokeStyle = cc.highlight
    ctx.lineWidth = 2
    ctx.stroke()

    // Axis labels
    ctx.fillStyle = '#a1a1aa'
    ctx.font = 'italic 11px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('x', w / 2, h - 2)
    ctx.save()
    ctx.translate(12, pad.top + chartH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(yLabel, 0, 0)
    ctx.restore()
  }, [table, color, yLabel])

  return <canvas ref={canvasRef} className="w-full" style={{ height: 220 }} />
}
