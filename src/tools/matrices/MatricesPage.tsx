import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ChevronDown, ChevronRight, Calculator, Copy, ClipboardPaste } from 'lucide-react'
import {
  multiply,
  echelon,
  inverse,
  determinant,
  cofactors,
  solveSystem,
  fmtNum,
  cloneMatrix,
} from './operations'
import type {
  Matrix,
  Step,
  OperationResult,
  SystemResult,
  CramerTab,
  OperationType,
  EchelonTarget,
  DeterminantMethod,
  InverseMethod,
  SystemMethod,
} from './types'

const OP_LABELS: Record<OperationType, string> = {
  multiplication: 'Multiplicación',
  echelon: 'Escalonamiento',
  inverse: 'Inversa',
  determinant: 'Determinantes',
  cofactors: 'Cofactores',
  systems: 'Sistemas de ecuaciones',
  visualizer: 'Visualizer',
}

const OP_DESCRIPTIONS: Record<OperationType, string> = {
  multiplication: 'Multiplica dos matrices A × B',
  echelon: 'Triangular superior, inferior o identidad',
  inverse: 'Matriz inversa por Gauss-Jordan o cofactores',
  determinant: 'Sarrus, expansión por renglón o triangular',
  cofactors: 'Matriz de cofactores B y Adj(B)',
  systems: 'Gaussiana, Gauss-Jordan, Montante o Cramer',
  visualizer: 'Visualize 2D & 3D matrix transformations',
}

const VALID_OPS: OperationType[] = ['multiplication', 'echelon', 'inverse', 'determinant', 'cofactors', 'systems', 'visualizer']

export function MatricesPage() {
  const { opType: opParam } = useParams<{ opType: string }>()
  const opType: OperationType = VALID_OPS.includes(opParam as OperationType) ? (opParam as OperationType) : 'multiplication'
  const [result, setResult] = useState<OperationResult | null>(null)
  const [systemResult, setSystemResult] = useState<SystemResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stepsOpen, setStepsOpen] = useState(true)
  const [verifyOpen, setVerifyOpen] = useState(false)

  // Matrix A
  const [rowsA, setRowsA] = useState(3)
  const [colsA, setColsA] = useState(3)
  const [matA, setMatA] = useState<Matrix>(() => createEmpty(3, 3))

  // Matrix B
  const [rowsB, setRowsB] = useState(3)
  const [colsB, setColsB] = useState(3)
  const [matB, setMatB] = useState<Matrix>(() => createEmpty(3, 3))

  // Sub-options
  const [echelonTarget, setEchelonTarget] = useState<EchelonTarget>('upper')
  const [detMethod, setDetMethod] = useState<DeterminantMethod>('sarrus')
  const [invMethod, setInvMethod] = useState<InverseMethod>('gauss-jordan')
  const [sysMethod, setSysMethod] = useState<SystemMethod>('gaussian')
  const [expansionType, setExpansionType] = useState<'row' | 'col'>('row')
  const [expansionIndex, setExpansionIndex] = useState(0)

  // System equations (structured)
  const [sysSize, setSysSize] = useState(3)
  const [sysVars, setSysVars] = useState<string[]>(['x1', 'x2', 'x3'])
  const [sysCoeffs, setSysCoeffs] = useState<Matrix>(() => [[2,4,6],[4,5,6],[3,1,-2]])
  const [sysConstants, setSysConstants] = useState<number[]>([18, 24, 4])

  const resetResults = () => {
    setResult(null)
    setSystemResult(null)
    setError(null)
  }

  const calculate = useCallback(() => {
    resetResults()
    setStepsOpen(true)
    setVerifyOpen(false)

    try {
      if (opType === 'systems') {
        const sr = solveSystem(sysCoeffs, sysConstants, sysMethod, sysVars)
        setSystemResult(sr)
        return
      }

      let res: OperationResult

      switch (opType) {
        case 'multiplication':
          res = multiply(matA, matB)
          break
        case 'echelon':
          res = echelon(matA, echelonTarget)
          break
        case 'inverse':
          res = inverse(matA, invMethod)
          break
        case 'determinant':
          res = determinant(matA, detMethod, expansionType, expansionIndex)
          break
        case 'cofactors':
          res = cofactors(matA)
          break
        default:
          return
      }
      setResult(res)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [opType, matA, matB, echelonTarget, detMethod, invMethod, sysMethod, sysCoeffs, sysConstants, sysVars, expansionType, expansionIndex])

  // Enforce square for inverse, determinant, cofactors
  const needsSquare = opType === 'inverse' || opType === 'determinant' || opType === 'cofactors'
  const needsTwoMatrices = opType === 'multiplication'
  const needsSystem = opType === 'systems'
  const isVisualizer = opType === 'visualizer'

  const handleRowsAChange = (v: number) => {
    setRowsA(v)
    if (needsSquare) {
      setColsA(v)
      setMatA(resizeMatrix(matA, v, v))
    } else {
      setMatA(resizeMatrix(matA, v, colsA))
    }
  }

  const handleColsAChange = (v: number) => {
    setColsA(v)
    setMatA(resizeMatrix(matA, rowsA, v))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">{OP_LABELS[opType]}</h2>
        <p className="text-sm text-zinc-500 mt-2">{OP_DESCRIPTIONS[opType]}</p>
      </div>

      {/* Sub-options */}
      {opType === 'echelon' && (
        <SubOptions
          label="Forma objetivo"
          value={echelonTarget}
          onChange={v => setEchelonTarget(v as EchelonTarget)}
          options={[
            { value: 'upper', label: 'Triangular superior' },
            { value: 'lower', label: 'Triangular inferior' },
            { value: 'identity', label: 'Identidad (RREF)' },
          ]}
        />
      )}
      {opType === 'determinant' && (
        <>
          <SubOptions
            label="Método"
            value={detMethod}
            onChange={v => setDetMethod(v as DeterminantMethod)}
            options={[
              { value: 'sarrus', label: 'Sarrus (solo 3×3)' },
              { value: 'row-expansion', label: 'Expansión por renglón/columna' },
              { value: 'triangular', label: 'Matriz triangular' },
            ]}
          />
          {detMethod === 'row-expansion' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Expandir por:</span>
              <button
                onClick={() => setExpansionType('row')}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  expansionType === 'row'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                Renglón
              </button>
              <button
                onClick={() => setExpansionType('col')}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  expansionType === 'col'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                Columna
              </button>
              <select
                value={expansionIndex}
                onChange={e => setExpansionIndex(+e.target.value)}
                className="rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
              >
                {Array.from({ length: rowsA }, (_, i) => (
                  <option key={i} value={i}>{i + 1}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
      {opType === 'inverse' && (
        <SubOptions
          label="Método"
          value={invMethod}
          onChange={v => setInvMethod(v as InverseMethod)}
          options={[
            { value: 'gauss-jordan', label: 'Gauss-Jordan (aumentada)' },
            { value: 'cofactors', label: 'Cofactores' },
          ]}
        />
      )}
      {opType === 'systems' && (
        <SubOptions
          label="Método"
          value={sysMethod}
          onChange={v => setSysMethod(v as SystemMethod)}
          options={[
            { value: 'gaussian', label: 'Eliminación Gaussiana' },
            { value: 'gauss-jordan', label: 'Gauss-Jordan' },
            { value: 'montante', label: 'Montante (Bareiss)' },
            { value: 'cramer', label: 'Regla de Cramer' },
          ]}
        />
      )}

      {/* Visualizer */}
      {isVisualizer && <MatrixVisualizer />}

      {/* Input area */}
      {!needsSystem && !isVisualizer && (
        <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-5">
          <div className={needsTwoMatrices ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
            {/* Matrix A */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Matriz A</p>
                <DimensionPicker
                  rows={rowsA}
                  cols={needsSquare ? rowsA : colsA}
                  onRowsChange={handleRowsAChange}
                  onColsChange={needsSquare ? handleRowsAChange : handleColsAChange}
                  lockSquare={needsSquare}
                />
                <CopyPasteButtons
                  matrix={matA}
                  rows={rowsA}
                  cols={needsSquare ? rowsA : colsA}
                  onPaste={(m, r, c) => {
                    const size = needsSquare ? Math.min(r, c, 7) : undefined
                    const newRows = size ?? Math.min(r, 7)
                    const newCols = size ?? Math.min(c, 7)
                    setRowsA(newRows)
                    if (!needsSquare) setColsA(newCols)
                    setMatA(resizeMatrix(m, newRows, newCols))
                  }}
                />
              </div>
              <MatrixGrid
                matrix={matA}
                rows={rowsA}
                cols={needsSquare ? rowsA : colsA}
                gridId="matA"
                onChange={(r, c, v) => {
                  const next = cloneMatrix(matA)
                  next[r][c] = v
                  setMatA(next)
                }}
                onPasteMatrix={(m, r, c) => {
                  const size = needsSquare ? Math.min(r, c, 7) : undefined
                  const newRows = size ?? Math.min(r, 7)
                  const newCols = size ?? Math.min(c, 7)
                  setRowsA(newRows)
                  if (!needsSquare) setColsA(newCols)
                  setMatA(resizeMatrix(m, newRows, newCols))
                }}
              />
            </div>

            {/* Matrix B */}
            {needsTwoMatrices && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Matriz B</p>
                  <DimensionPicker
                    rows={rowsB}
                    cols={colsB}
                    onRowsChange={(v) => { setRowsB(v); setMatB(resizeMatrix(matB, v, colsB)) }}
                    onColsChange={(v) => { setColsB(v); setMatB(resizeMatrix(matB, rowsB, v)) }}
                  />
                  <CopyPasteButtons
                    matrix={matB}
                    rows={rowsB}
                    cols={colsB}
                    onPaste={(m, r, c) => {
                      const newRows = Math.min(r, 7)
                      const newCols = Math.min(c, 7)
                      setRowsB(newRows)
                      setColsB(newCols)
                      setMatB(resizeMatrix(m, newRows, newCols))
                    }}
                  />
                </div>
                <MatrixGrid
                  matrix={matB}
                  rows={rowsB}
                  cols={colsB}
                  gridId="matB"
                  onChange={(r, c, v) => {
                    const next = cloneMatrix(matB)
                    next[r][c] = v
                    setMatB(next)
                  }}
                  onPasteMatrix={(m, r, c) => {
                    setRowsB(Math.min(r, 7))
                    setColsB(Math.min(c, 7))
                    setMatB(resizeMatrix(m, Math.min(r, 7), Math.min(c, 7)))
                  }}
                />
              </div>
            )}
          </div>

          <Button onClick={calculate} variant="primary" size="md">
            <Calculator size={14} /> Calcular
          </Button>
        </div>
      )}
      {needsSystem && (
        <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Sistema de ecuaciones</p>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <select
                value={sysSize}
                onChange={e => {
                  const n = +e.target.value
                  setSysSize(n)
                  setSysVars(prev => Array.from({ length: n }, (_, i) => prev[i] || `x${i + 1}`))
                  setSysCoeffs(prev => resizeMatrix(prev, n, n))
                  setSysConstants(prev => Array.from({ length: n }, (_, i) => prev[i] ?? 0))
                }}
                className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs outline-none focus:border-blue-400"
              >
                {[2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}×{n}</option>)}
              </select>
              <span className="text-[10px] text-zinc-400">ecuaciones</span>
            </div>
            <SystemCopyPaste
              coeffs={sysCoeffs}
              constants={sysConstants}
              size={sysSize}
              onPaste={(coeffs, constants, size) => {
                setSysSize(size)
                setSysVars(prev => Array.from({ length: size }, (_, i) => prev[i] || `x${i + 1}`))
                setSysCoeffs(coeffs)
                setSysConstants(constants)
              }}
            />
          </div>

          {/* Variable names */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-zinc-400">Variables:</span>
            {sysVars.map((v, i) => (
              <input
                key={i}
                type="text"
                value={v}
                onChange={e => {
                  const next = [...sysVars]
                  next[i] = e.target.value || `x${i + 1}`
                  setSysVars(next)
                }}
                className="w-14 rounded border border-zinc-200 px-2 py-1 text-center text-xs font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            ))}
          </div>

          {/* Equation rows */}
          <div className="space-y-2">
            {Array.from({ length: sysSize }, (_, i) => (
              <div key={i} className="flex items-center gap-1 flex-wrap">
                {Array.from({ length: sysSize }, (_, j) => (
                  <div key={j} className="flex items-center gap-0.5">
                    {j > 0 && <span className="text-sm text-zinc-400 w-4 text-center">+</span>}
                    <MatrixCell
                      value={sysCoeffs[i]?.[j] ?? 0}
                      onChange={v => {
                        const next = cloneMatrix(sysCoeffs)
                        next[i][j] = v
                        setSysCoeffs(next)
                      }}
                      gridId="sys-coeff"
                      row={i}
                      col={j}
                      maxRows={sysSize}
                      maxCols={sysSize}
                    />
                    <span className="text-sm font-mono text-zinc-500">{sysVars[j]}</span>
                  </div>
                ))}
                <span className="text-sm text-zinc-400 mx-1">=</span>
                <MatrixCell
                  value={sysConstants[i] ?? 0}
                  onChange={v => {
                    const next = [...sysConstants]
                    next[i] = v
                    setSysConstants(next)
                  }}
                  gridId="sys-const"
                  row={i}
                  col={0}
                  maxRows={sysSize}
                  maxCols={1}
                />
              </div>
            ))}
          </div>

          <Button onClick={calculate} variant="primary" size="md">
            <Calculator size={14} /> Resolver
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Matrix Operation Result */}
      {result && (
        <div className="space-y-4">
          {/* Result matrix (if not a scalar like determinant) */}
          {(result.result.length > 1 || result.result[0].length > 1) && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-3">Resultado</p>
              <MatrixDisplay matrix={result.result} />
            </div>
          )}

          {/* Determinant scalar result */}
          {opType === 'determinant' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Determinante</p>
              <p className="text-2xl font-bold font-mono text-blue-900">|A| = {fmtNum(result.result[0][0])}</p>
            </div>
          )}

          {/* Cofactors extra: Adjugate */}
          {opType === 'cofactors' && !!result.extra?.adjugate && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-3">Adj(B) — Adjunta</p>
              <MatrixDisplay matrix={result.extra.adjugate as Matrix} />
            </div>
          )}

          {/* Steps */}
          <StepsSection steps={result.steps} open={stepsOpen} onToggle={() => setStepsOpen(!stepsOpen)} />

          {/* Verification */}
          {result.verificationSteps && (
            <StepsSection
              steps={result.verificationSteps}
              open={verifyOpen}
              onToggle={() => setVerifyOpen(!verifyOpen)}
              title="Comprobación"
            />
          )}
        </div>
      )}

      {/* System Result */}
      {systemResult && (
        <div className="space-y-4">
          {/* Solution */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Solución</p>
            <div className="space-y-1">
              {systemResult.variables.map((v, i) => (
                <p key={v} className="text-lg font-mono font-semibold text-blue-900">
                  {v} = {fmtNum(systemResult.solution[i])}
                </p>
              ))}
            </div>
          </div>

          {/* Cramer tabs — per-matrix breakdown */}
          {systemResult.cramerTabs && (
            <CramerTabs tabs={systemResult.cramerTabs} />
          )}

          {/* Steps */}
          <StepsSection steps={systemResult.steps} open={stepsOpen} onToggle={() => setStepsOpen(!stepsOpen)} />

          {/* Verification */}
          {systemResult.verification && (
            <div className="bg-white border border-zinc-200 rounded-lg">
              <button
                onClick={() => setVerifyOpen(!verifyOpen)}
                className="w-full flex items-center gap-2 p-4 text-left"
              >
                {verifyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Comprobación</p>
              </button>
              {verifyOpen && (
                <div className="px-4 pb-4 space-y-1">
                  {systemResult.verification.map((line, i) => (
                    <p key={i} className="text-sm font-mono text-zinc-600">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Cramer Tabs ────────────────────────────────────────────────────────

function CramerTabs({ tabs }: { tabs: CramerTab[] }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [tabStepsOpen, setTabStepsOpen] = useState(true)
  const tab = tabs[activeIdx]

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2 overflow-x-auto border-b border-zinc-100">
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => { setActiveIdx(i); setTabStepsOpen(true) }}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              i === activeIdx
                ? 'border-blue-400 bg-blue-50 text-blue-700'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab && (
        <div className="p-4 space-y-3">
          {/* Matrix display */}
          <MatrixDisplay matrix={tab.matrix} />

          {/* Determinant result */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-sm font-mono font-semibold text-blue-900">
              {tab.label.startsWith('det(') ? tab.label : `det(${tab.label})`} = {fmtNum(tab.determinant)}
            </p>
          </div>

          {/* Variable result (for A_i tabs) */}
          {tab.variable != null && tab.value != null && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <p className="text-sm font-mono font-semibold text-emerald-900">
                {tab.variable} = det({tab.label}) / det(A) = {fmtNum(tab.determinant)} / {fmtNum(tabs[0].determinant)} = {fmtNum(tab.value)}
              </p>
            </div>
          )}

          {/* Steps for this determinant */}
          {tab.steps.length > 0 && (
            <div className="border border-zinc-100 rounded-lg">
              <button
                onClick={() => setTabStepsOpen(!tabStepsOpen)}
                className="w-full flex items-center gap-2 p-3 text-left"
              >
                {tabStepsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Procedimiento</p>
              </button>
              {tabStepsOpen && (
                <div className="px-3 pb-3 space-y-3">
                  {tab.steps.map((step, si) => (
                    <div key={si}>
                      <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-1">{step.label}</p>
                      <pre className="text-xs font-mono text-zinc-600 whitespace-pre-wrap">{step.description}</pre>
                      {step.matrix && <MatrixDisplay matrix={step.matrix} separatorCol={step.separatorCol} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

function matrixToClipboard(matrix: Matrix, rows: number, cols: number): string {
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => matrix[i]?.[j] ?? 0).join('\t')
  ).join('\n')
}

function clipboardToMatrix(text: string): { matrix: Matrix; rows: number; cols: number } | null {
  const lines = text.trim().split(/\n/).map(line =>
    line.trim().split(/[\t,;\s]+/).map(v => parseFloat(v)).filter(v => !isNaN(v))
  ).filter(row => row.length > 0)
  if (lines.length === 0) return null
  const cols = Math.max(...lines.map(r => r.length))
  const matrix = lines.map(row =>
    Array.from({ length: cols }, (_, j) => row[j] ?? 0)
  )
  return { matrix, rows: lines.length, cols }
}

function CopyPasteButtons({ matrix, rows, cols, onPaste }: {
  matrix: Matrix
  rows: number
  cols: number
  onPaste: (matrix: Matrix, rows: number, cols: number) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(matrixToClipboard(matrix, rows, cols))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = clipboardToMatrix(text)
      if (parsed) onPaste(parsed.matrix, parsed.rows, parsed.cols)
    } catch { /* clipboard permission denied */ }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleCopy}
        className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="Copy matrix"
      >
        <Copy size={13} />
      </button>
      <button
        onClick={handlePaste}
        className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="Paste matrix"
      >
        <ClipboardPaste size={13} />
      </button>
      {copied && <span className="text-[10px] text-green-600 font-medium">Copied!</span>}
    </div>
  )
}

function SystemCopyPaste({ coeffs, constants, size, onPaste }: {
  coeffs: Matrix
  constants: number[]
  size: number
  onPaste: (coeffs: Matrix, constants: number[], size: number) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    // Copy as augmented matrix [A | b] with tab separation
    const text = Array.from({ length: size }, (_, i) =>
      [...Array.from({ length: size }, (_, j) => coeffs[i]?.[j] ?? 0), constants[i] ?? 0].join('\t')
    ).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = clipboardToMatrix(text)
      if (!parsed || parsed.cols < 2) return
      const n = Math.min(parsed.rows, parsed.cols - 1, 7)
      const newCoeffs = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => parsed.matrix[i]?.[j] ?? 0)
      )
      const newConstants = Array.from({ length: n }, (_, i) => parsed.matrix[i]?.[n] ?? 0)
      onPaste(newCoeffs, newConstants, n)
    } catch { /* clipboard permission denied */ }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleCopy}
        className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="Copy system as augmented matrix [A|b]"
      >
        <Copy size={13} />
      </button>
      <button
        onClick={handlePaste}
        className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="Paste augmented matrix [A|b]"
      >
        <ClipboardPaste size={13} />
      </button>
      {copied && <span className="text-[10px] text-green-600 font-medium">Copied!</span>}
    </div>
  )
}

function createEmpty(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array(cols).fill(0))
}

function resizeMatrix(old: Matrix, newRows: number, newCols: number): Matrix {
  return Array.from({ length: newRows }, (_, i) =>
    Array.from({ length: newCols }, (_, j) =>
      old[i]?.[j] ?? 0
    )
  )
}

function SubOptions({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{label}:</span>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function DimensionPicker({ rows, cols, onRowsChange, onColsChange, lockSquare }: {
  rows: number
  cols: number
  onRowsChange: (v: number) => void
  onColsChange: (v: number) => void
  lockSquare?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
      <select
        value={rows}
        onChange={e => onRowsChange(+e.target.value)}
        className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs outline-none focus:border-blue-400"
      >
        {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <span>×</span>
      <select
        value={cols}
        onChange={e => onColsChange(+e.target.value)}
        disabled={lockSquare}
        className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs outline-none focus:border-blue-400 disabled:opacity-50"
      >
        {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      {lockSquare && <span className="text-[10px] text-zinc-400">(cuadrada)</span>}
    </div>
  )
}

// ─── Dynamic Matrix Input ───────────────────────────────────────────────

function parseInputValue(raw: string): number {
  const s = raw.trim()
  if (!s) return 0
  if (s.includes('/')) {
    const [num, den] = s.split('/')
    const n = parseFloat(num)
    const d = parseFloat(den)
    if (!d || isNaN(n) || isNaN(d)) return 0
    return n / d
  }
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}

function formatCellValue(n: number): string {
  if (n === 0) return '0'
  // Show integer if integer
  if (Number.isInteger(n)) return String(n)
  // Try to show as fraction if close to a simple one
  for (let d = 2; d <= 12; d++) {
    const num = n * d
    if (Math.abs(num - Math.round(num)) < 1e-9) {
      return `${Math.round(num)}/${d}`
    }
  }
  return String(Math.round(n * 10000) / 10000)
}

function focusCell(gridId: string, row: number, col: number) {
  const el = document.querySelector<HTMLInputElement>(
    `[data-grid="${gridId}"][data-row="${row}"][data-col="${col}"]`
  )
  el?.focus()
}

const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

function NumericKeypad({ value, onConfirm, onCancel }: {
  value: string
  onConfirm: (val: string) => void
  onCancel: () => void
}) {
  const [display, setDisplay] = useState(value)

  const press = (ch: string) => {
    if (ch === '⌫') setDisplay(prev => prev.slice(0, -1) || '0')
    else if (ch === '±') setDisplay(prev => prev.startsWith('-') ? prev.slice(1) : '-' + prev)
    else if (ch === '✓') onConfirm(display)
    else setDisplay(prev => prev === '0' ? ch : prev + ch)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20" onClick={onCancel}>
      <div
        className="w-full max-w-sm bg-white rounded-t-2xl shadow-2xl p-3 pb-6 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Display */}
        <div className="bg-zinc-100 rounded-lg px-3 py-2 text-right text-lg font-mono font-semibold text-zinc-800 min-h-[40px]">
          {display || '0'}
        </div>
        {/* Keys */}
        <div className="grid grid-cols-4 gap-1.5">
          {['7','8','9','⌫','4','5','6','±','1','2','3','/','.',`0`,''].map((k, i) => (
            k ? (
              <button
                key={i}
                onClick={() => press(k)}
                className={`py-3 rounded-lg text-base font-semibold transition-colors ${
                  k === '⌫' ? 'bg-red-100 text-red-600 active:bg-red-200' :
                  k === '±' || k === '/' ? 'bg-zinc-200 text-zinc-700 active:bg-zinc-300' :
                  'bg-zinc-100 text-zinc-800 active:bg-zinc-200'
                }`}
              >
                {k}
              </button>
            ) : <div key={i} />
          ))}
          <button
            onClick={() => onConfirm(display)}
            className="col-span-4 py-3 rounded-lg bg-blue-500 text-white font-semibold text-base active:bg-blue-600"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

function MatrixCell({ value, onChange, gridId, row, col, maxRows, maxCols }: {
  value: number
  onChange: (v: number) => void
  gridId: string
  row: number
  col: number
  maxRows: number
  maxCols: number
}) {
  const [editing, setEditing] = useState(false)
  const [textValue, setTextValue] = useState(formatCellValue(value))
  const [showKeypad, setShowKeypad] = useState(false)

  // Sync when external value changes
  useEffect(() => {
    if (!editing) setTextValue(formatCellValue(value))
  }, [value, editing])

  const commit = (raw: string) => {
    const parsed = parseInputValue(raw)
    onChange(parsed)
    setTextValue(formatCellValue(parsed))
    setEditing(false)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setEditing(true)
    if (isTouchDevice) {
      e.target.blur()
      setShowKeypad(true)
    } else {
      e.target.select()
    }
  }

  const handleBlur = () => {
    commit(textValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod) return // let copy/paste propagate

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        if (col < maxCols - 1) focusCell(gridId, row, col + 1)
        else if (row < maxRows - 1) focusCell(gridId, row + 1, 0)
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (col > 0) focusCell(gridId, row, col - 1)
        else if (row > 0) focusCell(gridId, row - 1, maxCols - 1)
        break
      case 'ArrowDown':
        e.preventDefault()
        if (row < maxRows - 1) focusCell(gridId, row + 1, col)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (row > 0) focusCell(gridId, row - 1, col)
        break
      case 'Enter':
        e.preventDefault()
        commit(textValue)
        if (row < maxRows - 1) focusCell(gridId, row + 1, col)
        else if (col < maxCols - 1) focusCell(gridId, row, col + 1)
        break
    }
  }

  return (
    <>
      <input
        data-grid={gridId}
        data-row={row}
        data-col={col}
        type="text"
        inputMode={isTouchDevice ? 'none' : 'decimal'}
        value={textValue}
        onChange={(e) => { setEditing(true); setTextValue(e.target.value) }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-16 rounded border border-zinc-200 px-2 py-1.5 text-center text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      />
      {showKeypad && (
        <NumericKeypad
          value={textValue}
          onConfirm={(val) => { commit(val); setShowKeypad(false) }}
          onCancel={() => { setShowKeypad(false); setEditing(false) }}
        />
      )}
    </>
  )
}

function MatrixGrid({ matrix, rows, cols, onChange, onPasteMatrix, gridId = 'default' }: {
  matrix: Matrix
  rows: number
  cols: number
  onChange: (r: number, c: number, v: number) => void
  onPasteMatrix?: (matrix: Matrix, rows: number, cols: number) => void
  gridId?: string
}) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey
    if (!mod) return

    if (e.key === 'c') {
      e.preventDefault()
      navigator.clipboard.writeText(matrixToClipboard(matrix, rows, cols))
    } else if (e.key === 'v' && onPasteMatrix) {
      e.preventDefault()
      navigator.clipboard.readText().then(text => {
        const parsed = clipboardToMatrix(text)
        if (parsed) onPasteMatrix(parsed.matrix, parsed.rows, parsed.cols)
      }).catch(() => {})
    }
  }, [matrix, rows, cols, onPasteMatrix])

  return (
    <div className="inline-flex items-center gap-1" onKeyDown={handleKeyDown}>
      {/* Left bracket */}
      <div className="w-1.5 border-l-2 border-t-2 border-b-2 border-zinc-400 rounded-l-sm self-stretch" />
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows }, (_, i) =>
          Array.from({ length: cols }, (_, j) => (
            <MatrixCell
              key={`${i}-${j}`}
              value={matrix[i]?.[j] ?? 0}
              onChange={(v) => onChange(i, j, v)}
              gridId={gridId}
              row={i}
              col={j}
              maxRows={rows}
              maxCols={cols}
            />
          ))
        )}
      </div>
      {/* Right bracket */}
      <div className="w-1.5 border-r-2 border-t-2 border-b-2 border-zinc-400 rounded-r-sm self-stretch" />
    </div>
  )
}

function MatrixDisplay({ matrix, separatorCol }: { matrix: Matrix; separatorCol?: number }) {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(matrixToClipboard(matrix, rows, cols))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Build grid columns with separator
  const hasSep = separatorCol != null && separatorCol > 0 && separatorCol < cols
  const gridCols = hasSep
    ? `repeat(${separatorCol}, minmax(0, 1fr)) auto repeat(${cols - separatorCol}, minmax(0, 1fr))`
    : `repeat(${cols}, minmax(0, 1fr))`

  return (
    <div className="inline-flex items-start gap-2">
      <div className="inline-flex items-center gap-1">
        <div className="w-1.5 border-l-2 border-t-2 border-b-2 border-blue-400 rounded-l-sm self-stretch" />
        <div className="grid gap-1" style={{ gridTemplateColumns: gridCols }}>
          {matrix.map((row, i) =>
            row.flatMap((val, j) => {
              const cells: React.ReactNode[] = []
              if (hasSep && j === separatorCol) {
                cells.push(
                  <div key={`sep-${i}`} className="flex items-center justify-center px-0.5 text-zinc-400 font-mono text-sm select-none">
                    |
                  </div>
                )
              }
              cells.push(
                <div
                  key={`${i}-${j}`}
                  className="w-20 rounded bg-zinc-50 border border-zinc-100 px-2 py-1.5 text-center text-sm font-mono text-zinc-800"
                >
                  {fmtNum(val)}
                </div>
              )
              return cells
            })
          )}
        </div>
        <div className="w-1.5 border-r-2 border-t-2 border-b-2 border-blue-400 rounded-r-sm self-stretch" />
      </div>
      <button
        onClick={handleCopy}
        className="mt-1 p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
        title="Copy matrix"
      >
        {copied ? <span className="text-[10px] text-green-600 font-medium px-0.5">Copied!</span> : <Copy size={13} />}
      </button>
    </div>
  )
}

function StepsSection({ steps, open, onToggle, title = 'Procedimiento paso a paso' }: {
  steps: Step[]
  open: boolean
  onToggle: () => void
  title?: string
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-4 text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">{title}</p>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="border-b border-zinc-100 last:border-0 pb-3 last:pb-0">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">
                {step.label}
              </p>
              <pre className="text-sm font-mono text-zinc-600 whitespace-pre-wrap leading-relaxed">
                {step.description}
              </pre>
              {step.matrix && (
                <div className="mt-2">
                  <MatrixDisplay matrix={step.matrix} separatorCol={step.separatorCol} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Matrix Visualizer ──────────────────────────────────────────────────

type VisMode = '2d' | '3d'

interface Preset {
  label: string
  matrix2d: number[][]
  matrix3d: number[][]
}

const PRESETS: Preset[] = [
  { label: 'Identity', matrix2d: [[1,0],[0,1]], matrix3d: [[1,0,0],[0,1,0],[0,0,1]] },
  { label: 'Scale 2×', matrix2d: [[2,0],[0,2]], matrix3d: [[2,0,0],[0,2,0],[0,0,2]] },
  { label: 'Rotation 45°', matrix2d: [[0.707,-0.707],[0.707,0.707]], matrix3d: [[0.707,-0.707,0],[0.707,0.707,0],[0,0,1]] },
  { label: 'Shear X', matrix2d: [[1,1],[0,1]], matrix3d: [[1,1,0],[0,1,0],[0,0,1]] },
  { label: 'Reflection Y', matrix2d: [[-1,0],[0,1]], matrix3d: [[-1,0,0],[0,1,0],[0,0,1]] },
  { label: 'Projection X', matrix2d: [[1,0],[0,0]], matrix3d: [[1,0,0],[0,1,0],[0,0,0]] },
]

function MatrixVisualizer() {
  const [mode, setMode] = useState<VisMode>('2d')
  const [mat2d, setMat2d] = useState<number[][]>([[1,0],[0,1]])
  const [mat3d, setMat3d] = useState<number[][]>([[1,0,0],[0,1,0],[0,0,1]])
  const [showGrid, setShowGrid] = useState(true)
  const [showBasis, setShowBasis] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 3D rotation angles
  const [azimuth, setAzimuth] = useState(-0.5)
  const [elevation, setElevation] = useState(0.5)
  const dragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  const mat = mode === '2d' ? mat2d : mat3d
  const setMat = mode === '2d' ? setMat2d : setMat3d
  const dim = mode === '2d' ? 2 : 3

  const applyPreset = (p: Preset) => {
    if (mode === '2d') setMat2d(p.matrix2d.map(r => [...r]))
    else setMat3d(p.matrix3d.map(r => [...r]))
  }

  const resetMatrix = () => {
    if (mode === '2d') setMat2d([[1,0],[0,1]])
    else setMat3d([[1,0,0],[0,1,0],[0,0,1]])
  }

  // Compute determinant for display
  const det = mode === '2d'
    ? mat2d[0][0] * mat2d[1][1] - mat2d[0][1] * mat2d[1][0]
    : mat3d[0][0] * (mat3d[1][1]*mat3d[2][2] - mat3d[1][2]*mat3d[2][1])
    - mat3d[0][1] * (mat3d[1][0]*mat3d[2][2] - mat3d[1][2]*mat3d[2][0])
    + mat3d[0][2] * (mat3d[1][0]*mat3d[2][1] - mat3d[1][1]*mat3d[2][0])

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    if (mode === '2d') {
      draw2D(ctx, w, h, mat2d, showGrid, showBasis)
    } else {
      draw3D(ctx, w, h, mat3d, azimuth, elevation, showGrid, showBasis)
    }
  }, [mode, mat2d, mat3d, showGrid, showBasis, azimuth, elevation])

  // Mouse drag for 3D rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== '3d') return
    dragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    setAzimuth(a => a + dx * 0.01)
    setElevation(a => Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, a - dy * 0.01)))
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseUp = () => { dragging.current = false }

  return (
    <div className="space-y-4">
      {/* Mode toggle + presets */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Mode:</span>
        <button
          onClick={() => setMode('2d')}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === '2d' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          2D (2×2)
        </button>
        <button
          onClick={() => setMode('3d')}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === '3d' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          3D (3×3)
        </button>
      </div>

      {/* Presets */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Presets:</span>
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={resetMatrix}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        {/* Matrix input */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Transform Matrix</p>
            <CopyPasteButtons
              matrix={mat}
              rows={dim}
              cols={dim}
              onPaste={(m, r, c) => {
                const size = Math.min(r, c, dim)
                const resized = resizeMatrix(m, size, size)
                setMat(resized)
              }}
            />
          </div>
          <MatrixGrid
            matrix={mat}
            rows={dim}
            cols={dim}
            gridId="viz"
            onChange={(r, c, v) => {
              const next = mat.map(row => [...row])
              next[r][c] = v
              setMat(next)
            }}
            onPasteMatrix={(m, r, c) => {
              const size = Math.min(r, c, dim)
              setMat(resizeMatrix(m, size, size))
            }}
          />

          {/* Options */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
              <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="rounded" />
              Show grid
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
              <input type="checkbox" checked={showBasis} onChange={e => setShowBasis(e.target.checked)} className="rounded" />
              Show basis vectors
            </label>
          </div>

          {/* Determinant */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-0.5">
              {mode === '2d' ? 'det(A) — Area scale' : 'det(A) — Volume scale'}
            </p>
            <p className="text-lg font-bold font-mono text-blue-900">{det.toFixed(4)}</p>
          </div>
        </div>

        {/* Canvas */}
        <div className="bg-white border border-zinc-200 rounded-lg p-2 min-h-[400px] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="w-full h-full min-h-[400px]"
            style={{ cursor: mode === '3d' ? 'grab' : 'default' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>

      {mode === '3d' && (
        <p className="text-xs text-zinc-400 text-center">Drag on the canvas to rotate the 3D view</p>
      )}
    </div>
  )
}

// ─── 2D Drawing ──────────────────────────────────────────────────────────

function draw2D(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  mat: number[][],
  showGrid: boolean,
  showBasis: boolean,
) {
  const cx = w / 2
  const cy = h / 2
  const scale = Math.min(w, h) / 8

  // Helper to convert math coords to canvas
  const toCanvas = (x: number, y: number): [number, number] => [cx + x * scale, cy - y * scale]

  // Transform a 2D point
  const transform = (x: number, y: number): [number, number] => [
    mat[0][0] * x + mat[0][1] * y,
    mat[1][0] * x + mat[1][1] * y,
  ]

  // Background grid
  if (showGrid) {
    ctx.strokeStyle = '#e4e4e7'
    ctx.lineWidth = 0.5
    for (let i = -10; i <= 10; i++) {
      const [x1, y1] = toCanvas(i, -10)
      const [x2, y2] = toCanvas(i, 10)
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      const [x3, y3] = toCanvas(-10, i)
      const [x4, y4] = toCanvas(10, i)
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke()
    }
  }

  // Axes
  ctx.strokeStyle = '#a1a1aa'
  ctx.lineWidth = 1
  const [axL, axLy] = toCanvas(-10, 0)
  const [axR, axRy] = toCanvas(10, 0)
  ctx.beginPath(); ctx.moveTo(axL, axLy); ctx.lineTo(axR, axRy); ctx.stroke()
  const [ayB, ayBy] = toCanvas(0, -10)
  const [ayT, ayTy] = toCanvas(0, 10)
  ctx.beginPath(); ctx.moveTo(ayB, ayBy); ctx.lineTo(ayT, ayTy); ctx.stroke()

  // Original unit square (dashed)
  const origPts: [number, number][] = [[0,0],[1,0],[1,1],[0,1]]
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = '#a1a1aa'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  origPts.forEach((p, i) => {
    const [px, py] = toCanvas(p[0], p[1])
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])

  // Transformed unit square
  const transPts = origPts.map(([x, y]) => transform(x, y))
  ctx.fillStyle = 'rgba(59, 130, 246, 0.12)'
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.beginPath()
  transPts.forEach(([x, y], i) => {
    const [px, py] = toCanvas(x, y)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Basis vectors
  if (showBasis) {
    // Original basis (faded)
    drawArrow(ctx, toCanvas(0, 0), toCanvas(1, 0), '#fca5a5', 1.5)
    drawArrow(ctx, toCanvas(0, 0), toCanvas(0, 1), '#86efac', 1.5)

    // Transformed basis
    const [e1x, e1y] = transform(1, 0)
    const [e2x, e2y] = transform(0, 1)
    drawArrow(ctx, toCanvas(0, 0), toCanvas(e1x, e1y), '#ef4444', 2.5)
    drawArrow(ctx, toCanvas(0, 0), toCanvas(e2x, e2y), '#22c55e', 2.5)

    // Labels
    ctx.font = 'bold 12px monospace'
    const [lx1, ly1] = toCanvas(e1x, e1y)
    ctx.fillStyle = '#ef4444'
    ctx.fillText(`e₁(${e1x.toFixed(1)}, ${e1y.toFixed(1)})`, lx1 + 6, ly1 - 6)
    const [lx2, ly2] = toCanvas(e2x, e2y)
    ctx.fillStyle = '#22c55e'
    ctx.fillText(`e₂(${e2x.toFixed(1)}, ${e2y.toFixed(1)})`, lx2 + 6, ly2 - 6)
  }

  // Origin dot
  const [ox, oy] = toCanvas(0, 0)
  ctx.fillStyle = '#18181b'
  ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill()
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  color: string,
  lineWidth: number,
) {
  const [fx, fy] = from
  const [tx, ty] = to
  const angle = Math.atan2(ty - fy, tx - fx)
  const headLen = 10

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth

  ctx.beginPath()
  ctx.moveTo(fx, fy)
  ctx.lineTo(tx, ty)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(tx, ty)
  ctx.lineTo(tx - headLen * Math.cos(angle - 0.4), ty - headLen * Math.sin(angle - 0.4))
  ctx.lineTo(tx - headLen * Math.cos(angle + 0.4), ty - headLen * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

// ─── 3D Drawing ──────────────────────────────────────────────────────────

function draw3D(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  mat: number[][],
  azimuth: number,
  elevation: number,
  showGrid: boolean,
  showBasis: boolean,
) {
  const cx = w / 2
  const cy = h / 2
  const scale = Math.min(w, h) / 6

  const cosA = Math.cos(azimuth), sinA = Math.sin(azimuth)
  const cosE = Math.cos(elevation), sinE = Math.sin(elevation)

  // Project 3D → 2D (simple rotation-based projection)
  const project = (x: number, y: number, z: number): [number, number] => {
    // Rotate around Y axis (azimuth)
    const rx = x * cosA + z * sinA
    const rz = -x * sinA + z * cosA
    // Rotate around X axis (elevation)
    const ry = y * cosE - rz * sinE
    return [cx + rx * scale, cy - ry * scale]
  }

  // Transform a 3D point by the matrix
  const transform = (x: number, y: number, z: number): [number, number, number] => [
    mat[0][0]*x + mat[0][1]*y + mat[0][2]*z,
    mat[1][0]*x + mat[1][1]*y + mat[1][2]*z,
    mat[2][0]*x + mat[2][1]*y + mat[2][2]*z,
  ]

  // Grid on XZ plane
  if (showGrid) {
    ctx.strokeStyle = '#e4e4e7'
    ctx.lineWidth = 0.5
    for (let i = -4; i <= 4; i++) {
      const [x1, y1] = project(i, 0, -4)
      const [x2, y2] = project(i, 0, 4)
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      const [x3, y3] = project(-4, 0, i)
      const [x4, y4] = project(4, 0, i)
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke()
    }
  }

  // Axes
  ctx.lineWidth = 1
  ctx.strokeStyle = '#a1a1aa'
  const axes: [number,number,number][] = [[4,0,0],[0,4,0],[0,0,4]]
  const axisLabels = ['X', 'Y', 'Z']
  axes.forEach(([ax,ay,az], i) => {
    const [fx, fy] = project(0,0,0)
    const [tx, ty] = project(ax,ay,az)
    ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(tx,ty); ctx.stroke()
    ctx.fillStyle = '#71717a'
    ctx.font = '11px monospace'
    ctx.fillText(axisLabels[i], tx + 4, ty - 4)
  })

  // Unit cube vertices
  const cubeVerts: [number,number,number][] = [
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1],
  ]
  const cubeEdges: [number,number][] = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ]

  // Draw original cube (dashed)
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = '#a1a1aa'
  ctx.lineWidth = 1
  cubeEdges.forEach(([a, b]) => {
    const [x1, y1] = project(...cubeVerts[a])
    const [x2, y2] = project(...cubeVerts[b])
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  })
  ctx.setLineDash([])

  // Draw transformed cube
  const transVerts = cubeVerts.map(v => transform(...v))
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  cubeEdges.forEach(([a, b]) => {
    const [x1, y1] = project(...transVerts[a])
    const [x2, y2] = project(...transVerts[b])
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  })

  // Draw some faces with transparency (front and top)
  const drawFace = (indices: number[], color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    indices.forEach((idx, i) => {
      const [px, py] = project(...transVerts[idx])
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fill()
  }
  drawFace([0,1,2,3], 'rgba(59, 130, 246, 0.08)')
  drawFace([4,5,6,7], 'rgba(59, 130, 246, 0.08)')
  drawFace([2,3,7,6], 'rgba(59, 130, 246, 0.06)')

  // Basis vectors
  if (showBasis) {
    const [e1x,e1y,e1z] = transform(1,0,0)
    const [e2x,e2y,e2z] = transform(0,1,0)
    const [e3x,e3y,e3z] = transform(0,0,1)
    const origin = project(0,0,0)

    drawArrow(ctx, origin, project(e1x,e1y,e1z), '#ef4444', 2.5)
    drawArrow(ctx, origin, project(e2x,e2y,e2z), '#22c55e', 2.5)
    drawArrow(ctx, origin, project(e3x,e3y,e3z), '#3b82f6', 2.5)

    ctx.font = 'bold 11px monospace'
    const [lx1,ly1] = project(e1x,e1y,e1z)
    ctx.fillStyle = '#ef4444'
    ctx.fillText('e₁', lx1 + 6, ly1 - 6)
    const [lx2,ly2] = project(e2x,e2y,e2z)
    ctx.fillStyle = '#22c55e'
    ctx.fillText('e₂', lx2 + 6, ly2 - 6)
    const [lx3,ly3] = project(e3x,e3y,e3z)
    ctx.fillStyle = '#3b82f6'
    ctx.fillText('e₃', lx3 + 6, ly3 - 6)
  }

  // Origin dot
  const [ox, oy] = project(0, 0, 0)
  ctx.fillStyle = '#18181b'
  ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill()
}
