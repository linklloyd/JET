import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { MathInput, MathDisplay, CollapsibleSection } from '../../components/ui/MathInput'
import { Calculator, CheckCircle2, AlertTriangle } from 'lucide-react'
import { solveIntegral } from './solver'
import { latexToAlgebrite, algebriteToLatex, detectVariable } from '../../lib/math-parser'
import type { IntegralMethod, IntegralResult } from './types'

const VALID_METHODS = ['indefinite', 'definite', 'by-parts', 'substitution', 'partial-fractions'] as const

const METHOD_INFO: Record<string, { title: string; description: string }> = {
  indefinite: {
    title: 'Integral Indefinida',
    description: 'Calcula la antiderivada de una función. Detecta automáticamente la técnica más apropiada.',
  },
  definite: {
    title: 'Integral Definida',
    description: 'Calcula el valor numérico de una integral evaluada entre dos límites.',
  },
  'by-parts': {
    title: 'Integración por Partes',
    description: 'Aplica la fórmula ∫u dv = uv − ∫v du usando la regla LIATE para elegir u y dv.',
  },
  substitution: {
    title: 'Sustitución (u-sub)',
    description: 'Identifica una sustitución u = g(x) para simplificar la integral.',
  },
  'partial-fractions': {
    title: 'Fracciones Parciales',
    description: 'Descompone fracciones racionales en fracciones simples antes de integrar.',
  },
}

export function IntegralsPage() {
  const { method } = useParams<{ method: string }>()

  if (!method || !VALID_METHODS.includes(method as typeof VALID_METHODS[number])) {
    return <Navigate to="/integrals/indefinite" replace />
  }

  return <IntegralsView method={method as IntegralMethod} />
}

function IntegralsView({ method }: { method: IntegralMethod }) {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState<IntegralResult | null>(null)

  const info = METHOD_INFO[method]

  const handleCalculate = () => {
    if (!expression.trim()) return

    try {
      const algebriteExpr = latexToAlgebrite(expression)
      const variable = detectVariable(expression)
      const res = solveIntegral(algebriteExpr, variable, method)
      setResult(res)
    } catch (err) {
      setResult({
        input: expression,
        variable: detectVariable(expression),
        technique: 'direct',
        antiderivative: '',
        steps: [],
        verified: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const canCalculate = expression.trim().length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Integrales — {info.title}</h2>
        <p className="text-sm text-zinc-500 mt-2">{info.description}</p>
      </div>

      {/* Input Section */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
        <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Parámetros</p>

        <MathInput
          value={expression}
          onChange={setExpression}
          placeholder="ej: x^2 + 3x + 1"
        />

        <Button onClick={handleCalculate} disabled={!canCalculate} className="w-full">
          <Calculator size={16} /> Calcular Integral
        </Button>
      </div>

      {/* Result */}
      {result && !result.error && (
        <div className="space-y-4">
          {/* Answer card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Resultado</p>
                <div className="text-xl text-blue-900">
                  {method === 'definite' && result.definiteValue ? (
                    <span className="flex items-center gap-3">
                      <MathDisplay latex={algebriteToLatex(result.antiderivative)} />
                      <span className="text-blue-400">=</span>
                      <span className="font-bold">{result.definiteValue}</span>
                    </span>
                  ) : (
                    <MathDisplay latex={algebriteToLatex(result.antiderivative)} />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {result.verified ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 size={13} /> Verificado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle size={13} /> Sin verificar
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Steps */}
          <CollapsibleSection title="Pasos" defaultOpen={true}>
            <div className="space-y-4">
              {result.steps.filter((s) => s.label !== 'Verificación').map((step, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    {step.label}
                  </p>
                  <div className="text-base text-zinc-800 bg-zinc-50 rounded-lg px-4 py-3 overflow-x-auto">
                    <MathDisplay latex={algebriteToLatex(step.expression)} />
                  </div>
                  <p className="text-xs text-zinc-500">{step.description}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Verification */}
          <CollapsibleSection title="Verificación" defaultOpen={false}>
            <div className="space-y-3">
              {result.steps.filter((s) => s.label === 'Verificación').map((step, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-base text-zinc-800 bg-zinc-50 rounded-lg px-4 py-3 overflow-x-auto">
                    <MathDisplay latex={algebriteToLatex(step.expression)} />
                  </div>
                  <p className="text-xs text-zinc-500">{step.description}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* Error */}
      {result?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 font-medium">Error al resolver la integral</p>
          <p className="text-xs text-red-600 mt-1">{result.error}</p>
          <p className="text-xs text-zinc-500 mt-2">
            Verifica que la expresión sea válida. Ejemplos: <code className="bg-red-100 px-1 rounded">x^2</code>,{' '}
            <code className="bg-red-100 px-1 rounded">sin(x)</code>,{' '}
            <code className="bg-red-100 px-1 rounded">x*exp(x)</code>
          </p>
        </div>
      )}
    </div>
  )
}
