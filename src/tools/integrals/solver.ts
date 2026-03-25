import Algebrite from 'algebrite'
import { normalizeForCAS, formatExpression } from '../../lib/math-parser'
import type { IntegralStep, IntegralResult, IntegralMethod, IntegrationTechnique } from './types'

// Algebrite methods return objects with toString(), not raw strings
const cas = {
  run: (expr: string): string => String(Algebrite.run(expr)),
  integral: (expr: string, v?: string): string => String(v ? Algebrite.integral(expr, v) : Algebrite.integral(expr)),
  simplify: (expr: string): string => String(Algebrite.simplify(expr)),
  derivative: (expr: string, v?: string): string => String(v ? Algebrite.derivative(expr, v) : Algebrite.derivative(expr)),
  factor: (expr: string): string => String(Algebrite.factor(expr)),
}

// ---------------------------------------------------------------------------
// 27 Integration Formulas (strictly following the reference table)
// ---------------------------------------------------------------------------

interface Formula {
  id: number
  name: string
  formula: string            // LaTeX-style display of the formula
  description: string        // Spanish explanation
}

const FORMULAS: Formula[] = [
  { id: 1,  name: 'Regla de la suma',         formula: '\\int [f(u) \\pm g(u)]\\,du = \\int f(u)\\,du \\pm \\int g(u)\\,du',  description: 'Se integra cada término por separado' },
  { id: 2,  name: 'Múltiplo constante',        formula: '\\int k\\,du = k \\cdot \\int du = k \\cdot u + C',                   description: 'Se saca la constante fuera de la integral' },
  { id: 3,  name: 'Integral de du',            formula: '\\int du = u + C',                                                     description: 'La integral de du es simplemente u + C' },
  { id: 4,  name: 'Regla de la potencia',      formula: '\\int u^n\\,du = u^{n+1} \\cdot \\frac{1}{n+1} + C\\quad(n \\neq -1)', description: 'Se aplica la regla de la potencia' },
  { id: 5,  name: 'Integral de du/u',          formula: '\\int \\frac{du}{u} = \\ln|u| + C',                                    description: 'La integral de 1/u es el logaritmo natural de |u|' },
  { id: 6,  name: 'Integral de a^u',           formula: '\\int a^u\\,du = \\frac{a^u}{\\ln a} + C',                             description: 'Se aplica la fórmula para exponenciales con base constante a' },
  { id: 7,  name: 'Integral de e^u',           formula: '\\int e^u\\,du = e^u + C',                                             description: 'La integral de e^u es e^u' },
  { id: 8,  name: 'Integral de sen(u)',         formula: '\\int \\sin u\\,du = -\\cos u + C',                                    description: 'La integral del seno es menos coseno' },
  { id: 9,  name: 'Integral de cos(u)',         formula: '\\int \\cos u\\,du = \\sin u + C',                                     description: 'La integral del coseno es seno' },
  { id: 10, name: 'Integral de tan(u)',         formula: '\\int \\tan u\\,du = \\ln|\\sec u| + C',                               description: 'La integral de la tangente es ln|sec(u)|' },
  { id: 11, name: 'Integral de cot(u)',         formula: '\\int \\cot u\\,du = \\ln|\\sin u| + C',                               description: 'La integral de la cotangente es ln|sen(u)|' },
  { id: 12, name: 'Integral de sec(u)',         formula: '\\int \\sec u\\,du = \\ln|\\sec u + \\tan u| + C',                     description: 'La integral de la secante es ln|sec(u) + tan(u)|' },
  { id: 13, name: 'Integral de csc(u)',         formula: '\\int \\csc u\\,du = \\ln|\\csc u - \\cot u| + C',                     description: 'La integral de la cosecante es ln|csc(u) - cot(u)|' },
  { id: 14, name: 'Integral de sec²(u)',        formula: '\\int \\sec^2 u\\,du = \\tan u + C',                                   description: 'La integral de secante al cuadrado es tangente' },
  { id: 15, name: 'Integral de csc²(u)',        formula: '\\int \\csc^2 u\\,du = -\\cot u + C',                                  description: 'La integral de cosecante al cuadrado es menos cotangente' },
  { id: 16, name: 'Integral de sec(u)·tan(u)',  formula: '\\int \\sec u \\cdot \\tan u\\,du = \\sec u + C',                      description: 'La integral de sec(u)·tan(u) es sec(u)' },
  { id: 17, name: 'Integral de csc(u)·cot(u)',  formula: '\\int \\csc u \\cdot \\cot u\\,du = -\\csc u + C',                     description: 'La integral de csc(u)·cot(u) es -csc(u)' },
  { id: 18, name: 'Arco seno',                  formula: '\\int \\frac{du}{\\sqrt{a^2 - u^2}} = \\arcsin\\frac{u}{a} + C',       description: 'Se aplica la fórmula del arco seno' },
  { id: 19, name: 'Arco tangente',              formula: '\\int \\frac{du}{u^2 + a^2} = \\frac{1}{a} \\arctan\\frac{u}{a} + C',  description: 'Se aplica la fórmula del arco tangente' },
  { id: 20, name: 'Arco secante',               formula: '\\int \\frac{du}{u\\sqrt{u^2 - a^2}} = \\frac{1}{a} \\operatorname{arcsec}\\frac{u}{a} + C', description: 'Se aplica la fórmula del arco secante' },
  { id: 21, name: 'Logaritmo (u²-a²)',          formula: '\\int \\frac{du}{u^2 - a^2} = \\frac{1}{2a} \\ln\\left|\\frac{u-a}{u+a}\\right| + C', description: 'Se aplica la fórmula logarítmica para u²-a²' },
  { id: 22, name: 'Logaritmo (a²-u²)',          formula: '\\int \\frac{du}{a^2 - u^2} = \\frac{1}{2a} \\ln\\left|\\frac{a+u}{a-u}\\right| + C', description: 'Se aplica la fórmula logarítmica para a²-u²' },
  { id: 23, name: 'Logaritmo √(u²+a²)',         formula: '\\int \\frac{du}{\\sqrt{u^2 + a^2}} = \\ln\\left|u + \\sqrt{u^2 + a^2}\\right| + C', description: 'Se aplica la fórmula logarítmica con raíz' },
  { id: 24, name: 'Logaritmo √(u²-a²)',         formula: '\\int \\frac{du}{\\sqrt{u^2 - a^2}} = \\ln\\left|u + \\sqrt{u^2 - a^2}\\right| + C', description: 'Se aplica la fórmula logarítmica con raíz' },
  { id: 25, name: 'Integral con √(a²-u²)',      formula: '\\int \\sqrt{a^2 - u^2}\\,du = \\frac{u}{2}\\sqrt{a^2 - u^2} + \\frac{a^2}{2}\\arcsin\\frac{u}{a} + C', description: 'Se aplica la fórmula para raíz de a²-u²' },
  { id: 26, name: 'Integral con √(u²+a²)',      formula: '\\int \\sqrt{u^2 + a^2}\\,du = \\frac{u}{2}\\sqrt{u^2 + a^2} + \\frac{a^2}{2}\\ln\\left|u + \\sqrt{u^2 + a^2}\\right| + C', description: 'Se aplica la fórmula para raíz de u²+a²' },
  { id: 27, name: 'Integral con √(u²-a²)',      formula: '\\int \\sqrt{u^2 - a^2}\\,du = \\frac{u}{2}\\sqrt{u^2 - a^2} - \\frac{a^2}{2}\\ln\\left|u + \\sqrt{u^2 - a^2}\\right| + C', description: 'Se aplica la fórmula para raíz de u²-a²' },
]

function getFormula(id: number): Formula {
  return FORMULAS[id - 1]
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function solveIntegral(
  rawExpr: string,
  variable: string,
  method: IntegralMethod,
  bounds?: { lower: string; upper: string },
): IntegralResult {
  const expr = normalizeForCAS(rawExpr)
  const steps: IntegralStep[] = []

  try {
    // Step 1: Show the input
    const isDefinite = method === 'definite' && bounds
    if (isDefinite) {
      steps.push({
        label: 'Integral planteada',
        expression: `∫ from ${bounds.lower} to ${bounds.upper} of (${formatExpression(expr)}) d${variable}`,
        description: `Calcular la integral definida de ${formatExpression(expr)} con respecto a ${variable} desde ${bounds.lower} hasta ${bounds.upper}`,
      })
    } else {
      steps.push({
        label: 'Integral planteada',
        expression: `∫ (${formatExpression(expr)}) d${variable}`,
        description: `Calcular la integral de ${formatExpression(expr)} con respecto a ${variable}`,
      })
    }

    // Step 2: Detect or force technique
    const technique = detectTechnique(expr, variable, method)

    // Step 3: Generate technique-specific steps
    let antiderivative: string
    try {
      switch (technique) {
        case 'power-rule':
          antiderivative = solvePowerRule(expr, variable, steps)
          break
        case 'by-parts':
          antiderivative = solveByParts(expr, variable, steps)
          break
        case 'u-substitution':
          antiderivative = solveUSubstitution(expr, variable, steps)
          break
        case 'partial-fractions':
          antiderivative = solvePartialFractions(expr, variable, steps)
          break
        case 'direct':
        case 'trig-identity':
        case 'trig-substitution':
        default:
          antiderivative = solveWithFormulas(expr, variable, steps)
          break
      }
    } catch {
      // Fallback: try Algebrite directly
      try {
        const fallbackResult = cas.integral(expr, variable)
        const simplified = cas.simplify(fallbackResult)
        steps.push({
          label: 'Integración directa',
          expression: `∫(${formatExpression(expr)}) d${variable} = ${formatExpression(simplified)}`,
          description: 'Se aplica la fórmula de integración correspondiente',
        })
        antiderivative = simplified
      } catch (fallbackErr) {
        throw fallbackErr
      }
    }

    // Step 4: Add +C for indefinite
    if (!isDefinite) {
      const finalExpr = formatExpression(antiderivative) + ' + C'
      steps.push({
        label: 'Resultado',
        expression: finalExpr,
        description: 'Se agrega la constante de integración C',
      })
    }

    // Step 5: Evaluate definite integral
    let definiteValue: string | undefined
    if (isDefinite) {
      definiteValue = evaluateDefinite(antiderivative, variable, bounds, steps)
    }

    // Step 6: Verify by differentiating
    const verified = verifyResult(antiderivative, expr, variable, steps)

    return {
      input: rawExpr,
      variable,
      technique,
      antiderivative: isDefinite ? antiderivative : antiderivative + ' + C',
      steps,
      definiteValue,
      bounds,
      verified,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      input: rawExpr,
      variable,
      technique: 'direct',
      antiderivative: '',
      steps: [...steps, {
        label: 'Error',
        expression: message,
        description: 'No se pudo resolver la integral. Verifica la expresión.',
      }],
      verified: false,
      error: message,
    }
  }
}

// ---------------------------------------------------------------------------
// Technique detection
// ---------------------------------------------------------------------------

function detectTechnique(expr: string, variable: string, method: IntegralMethod): IntegrationTechnique {
  // Forced technique from subtab
  if (method === 'by-parts') return 'by-parts'
  if (method === 'substitution') return 'u-substitution'
  if (method === 'partial-fractions') return 'partial-fractions'

  // Check if it's a polynomial (uses sum rule + power rule + formula 5 for 1/x)
  if (isPolynomial(expr, variable)) return 'power-rule'

  // Check for pure exponential forms: a^(f(x)), e^(f(x)), exp(f(x))
  // These should use direct formula, not by-parts
  if (isPureExponential(expr, variable)) return 'direct'

  // Check for product of different classes → by parts
  if (isProductOfClasses(expr, variable)) return 'by-parts'

  // Check for composite functions → u-substitution
  if (hasCompositeFunction(expr, variable)) return 'u-substitution'

  // Check for rational expression → partial fractions
  if (isRationalExpression(expr, variable)) return 'partial-fractions'

  // Everything else: direct formula matching
  return 'direct'
}

function isPureExponential(expr: string, variable: string): boolean {
  const s = expr.replace(/\s/g, '')
  // Must be a SIMPLE exponential — no addition/subtraction at the top level
  // exp(anything): exp(2*x), exp(x+1)
  if (/^exp\([^)]*\)$/.test(s) && s.includes(variable)) return true
  // e^(anything): e^(2x), e^x — only if the whole expression is just e^(...)
  if (/^e\^[\({]?[^+\-]*[\)}]?$/.test(s) && s.includes(variable) && !s.includes('/')) return true
  // constant^(anything): 2^(2x), a^(4x) — whole expression is base^exponent
  const baseMatch = s.match(/^([a-zA-Z]|\d+)\^/)
  if (baseMatch && baseMatch[1] !== variable && baseMatch[1] !== 'e' && s.includes(variable) && !s.includes('/') && !s.includes('+')) return true
  return false
}

function isPolynomial(expr: string, variable: string): boolean {
  const cleaned = expr.replace(/\s/g, '')
  if (/\b(sin|cos|tan|ln|log|exp|sqrt|sec|csc|cot)\b/.test(cleaned)) return false
  const re = new RegExp(`^[\\d.+\\-*/^${variable}()\\s]+$`)
  return re.test(cleaned)
}

function isProductOfClasses(expr: string, variable: string): boolean {
  // Must have explicit multiplication between different function classes
  // e.g., x*sin(x), x^2*exp(x), x*ln(x) — but NOT sin(2*x), NOT (e^x+1)/(e^x-1)
  if (!expr.includes('*')) return false

  // Split at top-level * only (not inside parentheses)
  const parts = splitAtTopLevelChar(expr, '*')
  if (parts.length < 2) return false

  // Check that parts belong to different classes
  const classes = new Set<string>()
  for (const part of parts) {
    if (/\b(sin|cos|tan|sec|csc|cot)\b/.test(part)) classes.add('trig')
    else if (/\b(ln|log)\b/.test(part)) classes.add('log')
    else if (/\bexp\b|e\^/.test(part)) classes.add('exp')
    else if (part.includes(variable)) classes.add('algebraic')
    else classes.add('constant')
  }
  // Must have at least 2 non-constant different classes
  classes.delete('constant')
  return classes.size >= 2
}

/** Split at a character only when not inside parentheses */
function splitAtTopLevelChar(expr: string, ch: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(' || expr[i] === '{') depth++
    else if (expr[i] === ')' || expr[i] === '}') depth--
    if (depth === 0 && expr[i] === ch) {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else {
      current += expr[i]
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function hasCompositeFunction(expr: string, variable: string): boolean {
  // Check for functions with non-trivial arguments containing the variable
  // sin(2x), cos(x^2), exp(3x+1), ln(x^2+1), (2x+1)^5
  const funcPattern = new RegExp(`\\b(sin|cos|tan|ln|log|exp|sec|csc|cot)\\([^)]*[+\\-*/^].*${variable}[^)]*\\)`)
  const funcPattern2 = new RegExp(`\\b(sin|cos|tan|ln|log|exp|sec|csc|cot)\\([^)]*${variable}[^)]*[+\\-*/^][^)]*\\)`)
  const powerPattern = /\([^)]+\)\^\d/
  return funcPattern.test(expr) || funcPattern2.test(expr) || powerPattern.test(expr)
}

function isRationalExpression(expr: string, _variable: string): boolean {
  // Rational polynomial expression: has / with polynomial numerator/denominator
  // Exclude expressions with trig/exp/log — those need different techniques
  if (/\b(sin|cos|tan|exp|ln|log|sec|csc|cot)\b/.test(expr)) return false
  return expr.includes('/') && /\([^)]*[a-z][^)]*\)/.test(expr)
}

// ---------------------------------------------------------------------------
// Detect which formula applies to a single term
// ---------------------------------------------------------------------------

/** Extract balanced parenthesized content starting at position start (must be '(') */
function extractBalancedParenFromExpr(s: string, start: number): { content: string; end: number } | null {
  if (s[start] !== '(') return null
  let depth = 0
  for (let i = start; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0) return { content: s.slice(start + 1, i), end: i }
    }
  }
  return null
}

function detectFormulaForTerm(
  term: string,
  variable: string,
): { formulaId: number; substitutions?: Record<string, string> } | null {
  const t = term.trim()
  const v = variable

  // Formula 3: ∫du = u + C (just the variable itself, or "1")
  if (t === v || t === '1') {
    return { formulaId: 3 }
  }

  // Formula 5: ∫du/u = ln|u| + C  (term is 1/x or x^(-1))
  if (t === `1/${v}` || t === `${v}^(-1)`) {
    return { formulaId: 5 }
  }
  // Also check CAS: if degree is -1
  try {
    const deg = cas.run(`deg(${t}, ${v})`)
    if (evalToNumber(deg) === -1 && !t.includes('+') && !t.includes('-')) {
      const coeff = cas.run(`coeff(${t}, ${v}, -1)`)
      if (coeff && evalToNumber(coeff) !== 0) {
        return { formulaId: 5, substitutions: { coeff } }
      }
    }
  } catch { /* ignore */ }

  // Formula 7: ∫e^u du = e^u + C
  // Must be purely exp(...) — not exp(x)/(something) or exp(x)+something
  if (t === `exp(${v})` || t === `e^(${v})` || t === `e^${v}`) {
    return { formulaId: 7 }
  }
  // Match exp(anything) only if the entire expression is exp(balanced parens)
  {
    const expMatch = t.match(/^exp\(/)
    if (expMatch) {
      const balanced = extractBalancedParenFromExpr(t, 3) // start after "exp"
      if (balanced && balanced.end === t.length - 1 && t.slice(4, balanced.end).includes(v)) {
        return { formulaId: 7 }
      }
    }
  }

  // Formula 6: ∫a^u du = a^u/ln(a) + C (constant base, variable exponent)
  // Matches both numeric bases (2^x, 3^(2x)) and letter constants (a^(4x), b^x)
  const baseExpMatch = t.match(/^([a-zA-Z]|\d+)\^(.+)$/)
  if (baseExpMatch && baseExpMatch[1] !== v && baseExpMatch[1] !== 'e' && baseExpMatch[2].includes(v)) {
    return { formulaId: 6, substitutions: { a: baseExpMatch[1] } }
  }

  // Formula 8: ∫sin(u) du
  if (t === `sin(${v})`) return { formulaId: 8 }

  // Formula 9: ∫cos(u) du
  if (t === `cos(${v})`) return { formulaId: 9 }

  // Formula 10: ∫tan(u) du
  if (t === `tan(${v})`) return { formulaId: 10 }

  // Formula 11: ∫cot(u) du
  if (t === `cot(${v})`) return { formulaId: 11 }

  // Formula 12: ∫sec(u) du
  if (t === `sec(${v})`) return { formulaId: 12 }

  // Formula 13: ∫csc(u) du
  if (t === `csc(${v})`) return { formulaId: 13 }

  // Formula 14: ∫sec²(u) du
  if (t === `sec(${v})^2` || t === `sec(${v})*sec(${v})`) return { formulaId: 14 }

  // Formula 15: ∫csc²(u) du
  if (t === `csc(${v})^2` || t === `csc(${v})*csc(${v})`) return { formulaId: 15 }

  // Formula 16: ∫sec(u)·tan(u) du
  if (t === `sec(${v})*tan(${v})` || t === `tan(${v})*sec(${v})`) return { formulaId: 16 }

  // Formula 17: ∫csc(u)·cot(u) du
  if (t === `csc(${v})*cot(${v})` || t === `cot(${v})*csc(${v})`) return { formulaId: 17 }

  // Formula 4: ∫u^n du = u^(n+1)/(n+1) + C  (n ≠ -1)
  // This is the fallback for polynomial terms
  if (!t.includes('sin') && !t.includes('cos') && !t.includes('tan') &&
      !t.includes('sec') && !t.includes('csc') && !t.includes('cot') &&
      !t.includes('ln') && !t.includes('log') && !t.includes('exp')) {
    try {
      const deg = cas.run(`deg(${t}, ${v})`)
      const n = evalToNumber(deg)
      if (!isNaN(n) && n !== -1) {
        return { formulaId: n === 0 ? 3 : 4 }
      }
    } catch { /* ignore */ }
  }

  return null
}

// ---------------------------------------------------------------------------
// Power Rule solver (formulas 1, 2, 3, 4, 5)
// ---------------------------------------------------------------------------

function solvePowerRule(expr: string, variable: string, steps: IntegralStep[]): string {
  try {
    const expanded = cas.run(`expand(${expr})`)

    steps.push({
      label: 'Expandir expresión',
      expression: formatExpression(expanded),
      description: 'Se expande la expresión para identificar cada término',
    })

    const terms = splitIntoTerms(expanded)

    // Formula 1: Sum rule
    if (terms.length > 1) {
      const f = getFormula(1)
      steps.push({
        label: `Fórmula ${f.id}: ${f.name}`,
        expression: f.formula,
        description: f.description,
      })

      steps.push({
        label: 'Separar en integrales',
        expression: terms.map((t) => `∫(${formatExpression(t)}) d${variable}`).join(' + '),
        description: 'Se integra cada término por separado',
      })
    }

    // Integrate each term
    const integratedTerms: string[] = []
    for (const term of terms) {
      const termIntegral = cas.integral(term, variable)
      integratedTerms.push(termIntegral)

      const detected = detectFormulaForTerm(term, variable)
      const { coeff, exp: n } = extractCoeffAndExponent(term, variable)

      // Formula 2: constant multiple
      if (coeff !== '1' && coeff !== '-1' && n !== 0 && detected?.formulaId !== 5) {
        const f2 = getFormula(2)
        steps.push({
          label: `Fórmula ${f2.id}: ${f2.name}`,
          expression: `∫(${formatExpression(term)}) d${variable} = ${coeff} · ∫(${variable}^${n}) d${variable}`,
          description: `Se saca la constante k=${coeff} fuera de la integral: ∫k·f(u) du = k·∫f(u) du`,
        })
      }

      if (detected?.formulaId === 5) {
        // Formula 5: ∫du/u = ln|u| + C
        // Extract the actual coefficient for 1/x terms (e.g., 3/x → coeff=3)
        const f5coeff = extractCoefficientForReciprocal(term, variable)
        const f = getFormula(5)
        steps.push({
          label: `Fórmula ${f.id}: ${f.name}`,
          expression: f.formula,
          description: f.description,
        })
        if (f5coeff !== '1') {
          steps.push({
            label: `Integrar: ${formatExpression(term)}`,
            expression: `${f5coeff} · ln|${variable}| = ${formatExpression(termIntegral)}`,
            description: `Se aplica Fórmula 5 con coeficiente ${f5coeff}`,
          })
        } else {
          steps.push({
            label: `Integrar: ${formatExpression(term)}`,
            expression: `ln|${variable}|`,
            description: 'Se aplica Fórmula 5 directamente',
          })
        }
      } else if (n === 0) {
        // Formula 3: ∫du = u + C (constant term)
        const f = getFormula(3)
        steps.push({
          label: `Fórmula ${f.id}: ${f.name}`,
          expression: `∫(${coeff}) d${variable} = ${coeff}·${variable}`,
          description: `${f.description} — con constante ${coeff}`,
          value: formatExpression(termIntegral),
        })
      } else {
        // Formula 4: ∫u^n du = u^(n+1)/(n+1) (n ≠ -1)
        const f = getFormula(4)
        const nPlus1 = n + 1
        steps.push({
          label: `Fórmula ${f.id}: ${f.name}`,
          expression: f.formula,
          description: f.description,
        })
        steps.push({
          label: `Integrar: ${formatExpression(term)}`,
          expression: `(${coeff}) · (${variable}^(${nPlus1}))/(${nPlus1}) = ${formatExpression(termIntegral)}`,
          description: `Sustituir n=${n} en la Fórmula 4: ∫u^n du = u^(n+1)/(n+1)`,
          value: formatExpression(termIntegral),
        })
      }
    }

    const combined = integratedTerms.join(' + ')
    const simplified = cas.simplify(combined)

    steps.push({
      label: 'Combinar y simplificar',
      expression: formatExpression(simplified),
      description: 'Se combinan todos los términos integrados',
    })

    return simplified
  } catch {
    return solveWithFormulas(expr, variable, steps)
  }
}

// ---------------------------------------------------------------------------
// Direct formula matching (formulas 7-27)
// ---------------------------------------------------------------------------

function solveWithFormulas(expr: string, variable: string, steps: IntegralStep[]): string {
  const detected = detectFormulaForTerm(expr, variable)

  if (detected) {
    const f = getFormula(detected.formulaId)
    steps.push({
      label: `Fórmula ${f.id}: ${f.name}`,
      expression: f.formula,
      description: f.description,
    })
  }

  // Try Algebrite first
  try {
    const result = cas.integral(expr, variable)
    const simplified = cas.simplify(result)

    steps.push({
      label: 'Integración directa',
      expression: `∫(${formatExpression(expr)}) d${variable} = ${formatExpression(simplified)}`,
      description: detected
        ? `Se aplica la Fórmula ${detected.formulaId} directamente`
        : 'Se aplica la fórmula de integración correspondiente',
    })

    return simplified
  } catch {
    // Algebrite failed — try manual formula application
  }

  // Manual: Formula 6 — ∫a^(ku) du = a^(ku) / (k·ln(a)) + C
  if (detected?.formulaId === 6) {
    const manualResult = solveConstantBaseExponential(expr, variable, steps)
    if (manualResult) return manualResult
  }

  // Manual: Formula 7 — ∫e^(ku) du = e^(ku) / k + C
  if (detected?.formulaId === 7) {
    const manualResult = solveExpExponential(expr, variable, steps)
    if (manualResult) return manualResult
  }

  // Manual: Exponential substitution for rational-exponential expressions
  // e.g., e^x/(e^x+1), (e^x+1)/(e^x-1), 1/(1+e^x)
  if (/\bexp\(/.test(expr) && expr.includes('/')) {
    const manualResult = solveExpSubstitution(expr, variable, steps)
    if (manualResult) return manualResult
  }

  throw new Error('No se pudo resolver la integral')
}

// ---------------------------------------------------------------------------
// Manual formula solvers (when Algebrite can't handle it)
// ---------------------------------------------------------------------------

/** Solve ∫a^(f(x)) dx where a is a constant base
 *  For a^(kx): result = a^(kx) / (k·ln(a))
 *  For a^(kx+b): u-sub with u=kx+b, du=k dx → a^(kx+b) / (k·ln(a))
 */
function solveConstantBaseExponential(expr: string, variable: string, steps: IntegralStep[]): string | null {
  // Match patterns: a^(kx), 2^(k*x), a^(kx+b), a^x etc.
  // Supports both numeric bases (2, 3, 5) and letter constants (a, b, c)
  const match = expr.match(/^([a-zA-Z]|\d+)\^[\(]?(.+?)[\)]?$/)
  if (!match) return null

  const base = match[1]
  const exponent = match[2]

  // Extract coefficient of variable in the exponent
  // For "2*x" → k=2, for "x" → k=1, for "2*x+1" → k=2
  let k = '1'
  try {
    k = cas.run(`coeff(${exponent}, ${variable}, 1)`)
    if (k === '0' || !k) k = '1'
  } catch {
    k = '1'
  }

  const resultExpr = k === '1'
    ? `${base}^(${exponent})/log(${base})`
    : `${base}^(${exponent})/(${k}*log(${base}))`

  steps.push({
    label: 'Sustitución',
    expression: `u = ${formatExpression(exponent)}, du = ${k} d${variable}`,
    description: `Se identifica u = ${formatExpression(exponent)} en el exponente`,
  })

  steps.push({
    label: 'Aplicar fórmula',
    expression: k === '1'
      ? `${base}^(${formatExpression(exponent)}) / ln(${base})`
      : `${base}^(${formatExpression(exponent)}) / (${k} · ln(${base}))`,
    description: `Se aplica ∫a^u du = a^u / ln(a), con factor 1/${k} por la sustitución`,
  })

  try {
    return cas.simplify(resultExpr)
  } catch {
    return resultExpr
  }
}

/** Solve ∫e^(f(x)) dx where f(x) is linear
 *  For e^(kx): result = e^(kx) / k
 */
function solveExpExponential(expr: string, variable: string, steps: IntegralStep[]): string | null {
  // Match exp(...) or e^(...)
  const match = expr.match(/^exp\((.+)\)$/) || expr.match(/^e\^[\(]?(.+?)[\)]?$/)
  if (!match) return null

  const exponent = match[1]

  let k = '1'
  try {
    k = cas.run(`coeff(${exponent}, ${variable}, 1)`)
    if (k === '0' || !k) k = '1'
  } catch {
    k = '1'
  }

  const resultExpr = k === '1'
    ? `exp(${exponent})`
    : `exp(${exponent})/(${k})`

  steps.push({
    label: 'Sustitución',
    expression: `u = ${formatExpression(exponent)}, du = ${k} d${variable}`,
    description: `Se identifica u = ${formatExpression(exponent)} en el exponente`,
  })

  steps.push({
    label: 'Aplicar fórmula',
    expression: k === '1'
      ? `e^(${formatExpression(exponent)})`
      : `e^(${formatExpression(exponent)}) / ${k}`,
    description: k === '1'
      ? 'Se aplica ∫e^u du = e^u directamente'
      : `Se aplica ∫e^u du = e^u, con factor 1/${k} por la sustitución`,
  })

  try {
    return cas.simplify(resultExpr)
  } catch {
    return resultExpr
  }
}

/** Solve integrals with e^x substitution: u = e^x, du = e^x dx
 *  Handles: e^x/(e^x+1), (e^x+1)/(e^x-1), 1/(1+e^x), etc.
 *  Strategy: substitute u = e^x, rewrite in terms of u, solve, back-substitute.
 */
function solveExpSubstitution(expr: string, variable: string, steps: IntegralStep[]): string | null {
  try {
    // Substitute exp(x) → u and simplify
    const u = 'USUB'
    const substituted = expr.replace(/exp\(\s*\w\s*\)/g, u)

    steps.push({
      label: 'Sustitución',
      expression: `u = e^${variable},  du = e^${variable} d${variable}  →  d${variable} = du/u`,
      description: `Se sustituye u = e^${variable} para transformar la integral`,
    })

    // The integral becomes ∫ f(u) · (1/u) du since dx = du/u
    // Build the new integrand: substituted / u
    const newIntegrand = `(${substituted})/${u}`
    const simplified = cas.simplify(newIntegrand.replace(/USUB/g, 'u'))

    steps.push({
      label: 'Reescribir en términos de u',
      expression: `∫ ${formatExpression(simplified.replace(/\bu\b/g, 'u'))} du`,
      description: 'Se reescribe la integral en términos de u (recordando dx = du/u)',
    })

    // Solve the u-integral
    const uResult = cas.integral(simplified.replace(/\bUSUB\b/g, 'u'), 'u')
    const uSimplified = cas.simplify(uResult)

    steps.push({
      label: 'Integrar en u',
      expression: formatExpression(uSimplified),
      description: 'Se resuelve la integral en la variable u',
    })

    // Back-substitute u = exp(x)
    let finalResult = cas.simplify(uSimplified.replace(/\bu\b/g, `exp(${variable})`))

    // Post-process: simplify log expressions with exp(-x) terms
    // log(1-exp(-x)) = log((exp(x)-1)/exp(x)) = log(exp(x)-1) - x
    // log(1+exp(-x)) = log((exp(x)+1)/exp(x)) = log(exp(x)+1) - x
    finalResult = finalResult
      .replace(/log\(1-exp\(-(\w+)\)\)/g, (_, v) => `log(-1+exp(${v}))-${v}`)
      .replace(/log\(1\+exp\(-(\w+)\)\)/g, (_, v) => `log(1+exp(${v}))-${v}`)
      .replace(/-log\(1\+exp\(-(\w+)\)\)/g, (_, v) => `-log(1+exp(${v}))+${v}`)

    // Re-simplify after manual substitution
    try {
      finalResult = cas.simplify(finalResult)
    } catch { /* ignore */ }

    steps.push({
      label: 'Sustituir de vuelta',
      expression: `u = e^${variable} → ${formatExpression(finalResult)}`,
      description: `Se sustituye u = e^${variable} de vuelta en el resultado`,
    })

    return finalResult
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Integration by Parts solver
// ---------------------------------------------------------------------------

function solveByParts(expr: string, variable: string, steps: IntegralStep[]): string {
  try {
    steps.push({
      label: 'Fórmula: Integración por partes',
      expression: '∫u dv = uv − ∫v du',
      description: 'Se aplica la fórmula de integración por partes',
    })

    const { u, dv } = detectUAndDv(expr, variable)

    steps.push({
      label: 'Elegir u y dv (LIATE)',
      expression: `u = ${formatExpression(u)}    dv = ${formatExpression(dv)} d${variable}`,
      description: 'Se elige u según la regla LIATE: Logarítmica > Inversa trig > Algebraica > Trigonométrica > Exponencial',
    })

    const du = cas.derivative(u, variable)
    const v = cas.integral(dv, variable)

    steps.push({
      label: 'Calcular du y v',
      expression: `du = ${formatExpression(du)} d${variable}    v = ${formatExpression(v)}`,
      description: `Se deriva u para obtener du, y se integra dv para obtener v`,
    })

    const uvProduct = cas.simplify(`(${u}) * (${v})`)
    const remainingIntegrand = cas.simplify(`(${v}) * (${du})`)

    steps.push({
      label: 'Aplicar fórmula',
      expression: `${formatExpression(uvProduct)} − ∫(${formatExpression(remainingIntegrand)}) d${variable}`,
      description: 'Se sustituye en uv − ∫v du',
    })

    const remainingIntegral = cas.integral(remainingIntegrand, variable)

    steps.push({
      label: 'Resolver integral restante',
      expression: `∫(${formatExpression(remainingIntegrand)}) d${variable} = ${formatExpression(remainingIntegral)}`,
      description: 'Se resuelve la integral restante',
    })

    const result = cas.simplify(`(${uvProduct}) - (${remainingIntegral})`)

    steps.push({
      label: 'Simplificar',
      expression: formatExpression(result),
      description: 'Se simplifica el resultado final',
    })

    return result
  } catch {
    return solveWithFormulas(expr, variable, steps)
  }
}

function detectUAndDv(expr: string, variable: string): { u: string; dv: string } {
  const s = expr.replace(/\s/g, '')
  const parts = splitAtMultiplication(s)

  if (parts.length >= 2) {
    const classified = parts.map((p) => ({ expr: p, priority: liatePriority(p, variable) }))
    classified.sort((a, b) => a.priority - b.priority)
    return {
      u: classified[0].expr,
      dv: classified.slice(1).map((c) => c.expr).join('*'),
    }
  }

  return { u: variable, dv: expr.replace(new RegExp(`\\b${variable}\\b`), '1') }
}

function splitAtMultiplication(expr: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (ch === '(') depth++
    if (ch === ')') depth--

    if (depth === 0 && ch === '*') {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())

  return parts
}

function liatePriority(expr: string, _variable: string): number {
  const s = expr.toLowerCase()
  if (/\bln\b|\blog\b/.test(s)) return 0
  if (/\basin\b|\bacos\b|\batan\b/.test(s)) return 1
  if (/^[0-9a-z^+\-*/.\s]+$/.test(s) && !/\b(sin|cos|tan|exp|e\^)\b/.test(s)) return 2
  if (/\b(sin|cos|tan|sec|csc|cot)\b/.test(s)) return 3
  if (/\bexp\b|e\^/.test(s)) return 4
  return 2
}

// ---------------------------------------------------------------------------
// U-Substitution solver
// ---------------------------------------------------------------------------

function solveUSubstitution(expr: string, variable: string, steps: IntegralStep[]): string {
  try {
    const result = cas.integral(expr, variable)
    const innerFn = detectInnerFunction(expr, variable)

    if (innerFn) {
      const du = cas.derivative(innerFn, variable)

      steps.push({
        label: 'Identificar sustitución',
        expression: `u = ${formatExpression(innerFn)}`,
        description: 'Se identifica la función interna como sustitución',
      })

      steps.push({
        label: 'Calcular du',
        expression: `du = ${formatExpression(du)} d${variable}`,
        description: `Se deriva u respecto a ${variable}`,
      })

      steps.push({
        label: 'Reescribir integral',
        expression: `∫ f(u) du`,
        description: 'Se reescribe la integral en términos de u',
      })

      steps.push({
        label: 'Integrar en u',
        expression: formatExpression(result),
        description: 'Se integra la expresión simplificada y se sustituye de vuelta',
      })
    } else {
      steps.push({
        label: 'Integración directa',
        expression: formatExpression(result),
        description: 'Se aplica la sustitución internamente',
      })
    }

    return result
  } catch {
    return solveWithFormulas(expr, variable, steps)
  }
}

function detectInnerFunction(expr: string, variable: string): string | null {
  const funcMatch = expr.match(/\b(?:sin|cos|tan|ln|log|exp)\(([^)]+)\)/)
  if (funcMatch && funcMatch[1].includes(variable) && funcMatch[1] !== variable) {
    return funcMatch[1]
  }
  const parenPowerMatch = expr.match(/\(([^)]+)\)\^/)
  if (parenPowerMatch && parenPowerMatch[1].includes(variable)) {
    return parenPowerMatch[1]
  }
  return null
}

// ---------------------------------------------------------------------------
// Partial Fractions solver
// ---------------------------------------------------------------------------

function solvePartialFractions(expr: string, variable: string, steps: IntegralStep[]): string {
  try {
    const factored = cas.run(`factor(${expr})`)
    steps.push({
      label: 'Factorizar',
      expression: formatExpression(factored),
      description: 'Se factoriza la expresión (especialmente el denominador)',
    })

    const expanded = cas.run(`partfrac(${expr}, ${variable})`)
    steps.push({
      label: 'Descomposición en fracciones parciales',
      expression: formatExpression(expanded),
      description: 'Se descompone en fracciones parciales',
    })

    const result = cas.integral(expr, variable)
    const simplified = cas.simplify(result)
    steps.push({
      label: 'Integrar cada fracción',
      expression: formatExpression(simplified),
      description: 'Se integra cada fracción parcial por separado (aplicando Fórmulas 4 y 5)',
    })

    return simplified
  } catch {
    return solveWithFormulas(expr, variable, steps)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract coefficient for reciprocal terms like 3/x, -2/x, 1/x */
function extractCoefficientForReciprocal(term: string, variable: string): string {
  const t = term.trim()
  // Pattern: coeff/variable or coeff*variable^(-1)
  const match = t.match(new RegExp(`^([+-]?\\d*\\.?\\d*)\\/\\s*${variable}$`))
  if (match) {
    const c = match[1]
    return (!c || c === '+') ? '1' : c === '-' ? '-1' : c
  }
  // Pattern: coeff*x^(-1)
  const match2 = t.match(new RegExp(`^([+-]?\\d*\\.?\\d*)\\*?${variable}\\^\\(-?1\\)$`))
  if (match2) {
    const c = match2[1]
    return (!c || c === '+') ? '1' : c === '-' ? '-1' : c
  }
  // Try CAS: multiply by x and simplify to get the coefficient
  try {
    const c = cas.simplify(`(${t}) * ${variable}`)
    // If the result doesn't contain the variable, it's the coefficient
    if (!c.includes(variable)) return c
  } catch { /* ignore */ }
  return '1'
}

function evalToNumber(expr: string): number {
  const n = parseFloat(expr)
  if (!isNaN(n)) return n
  try {
    const f = cas.run(`float(${expr})`)
    return parseFloat(f) || 0
  } catch {
    return 0
  }
}

function extractCoeffAndExponent(term: string, variable: string): { coeff: string; exp: number } {
  const t = term.trim()

  if (!t.includes(variable)) {
    return { coeff: t, exp: 0 }
  }

  try {
    const degree = cas.run(`deg(${t}, ${variable})`)
    const n = evalToNumber(degree)
    const coeffStr = cas.run(`coeff(${t}, ${variable}, ${Math.round(n)})`)
    return { coeff: coeffStr || '1', exp: n }
  } catch {
    const match = t.match(/^([+-]?\d*\.?\d*)\*?([a-z])(?:\^(\d+))?$/)
    if (match) {
      const c = match[1] === '' || match[1] === '+' ? '1' : match[1] === '-' ? '-1' : match[1]
      const n = match[3] ? parseInt(match[3]) : 1
      return { coeff: c, exp: n }
    }
    return { coeff: '1', exp: 1 }
  }
}

function splitIntoTerms(expr: string): string[] {
  const terms: string[] = []
  let current = ''
  let depth = 0

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (ch === '(') depth++
    if (ch === ')') depth--

    if (depth === 0 && (ch === '+' || ch === '-') && i > 0) {
      if (current.trim()) terms.push(current.trim())
      current = ch === '-' ? '-' : ''
    } else {
      current += ch
    }
  }
  if (current.trim()) terms.push(current.trim())

  return terms.filter((t) => t && t !== '+')
}

// ---------------------------------------------------------------------------
// Definite integral evaluation
// ---------------------------------------------------------------------------

function evaluateDefinite(
  antiderivative: string,
  variable: string,
  bounds: { lower: string; upper: string },
  steps: IntegralStep[],
): string {
  const upper = normalizeForCAS(bounds.upper)
  const lower = normalizeForCAS(bounds.lower)

  const fUpper = cas.run(`subst(${upper}, ${variable}, ${antiderivative})`)
  const fUpperVal = cas.run(`float(${fUpper})`)

  const fLower = cas.run(`subst(${lower}, ${variable}, ${antiderivative})`)
  const fLowerVal = cas.run(`float(${fLower})`)

  steps.push({
    label: 'Evaluar en los límites',
    expression: `F(${bounds.upper}) = ${formatExpression(fUpper)} = ${fUpperVal}`,
    description: `Se evalúa la antiderivada en el límite superior ${bounds.upper}`,
  })

  steps.push({
    label: 'Evaluar en los límites',
    expression: `F(${bounds.lower}) = ${formatExpression(fLower)} = ${fLowerVal}`,
    description: `Se evalúa la antiderivada en el límite inferior ${bounds.lower}`,
  })

  const result = cas.run(`float((${fUpper}) - (${fLower}))`)
  const exactResult = cas.simplify(`(${fUpper}) - (${fLower})`)

  steps.push({
    label: 'Resultado definido',
    expression: `F(${bounds.upper}) − F(${bounds.lower}) = ${formatExpression(exactResult)} = ${result}`,
    description: `La integral definida es F(b) − F(a) = ${result}`,
    value: result,
  })

  return result
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function verifyResult(
  antiderivative: string,
  originalExpr: string,
  variable: string,
  steps: IntegralStep[],
): boolean {
  try {
    const deriv = cas.derivative(antiderivative, variable)
    const simplified = cas.simplify(deriv)
    const diff = cas.simplify(`(${simplified}) - (${originalExpr})`)
    const isZero = diff === '0' || cas.run(`float(${diff})`) === '0'

    steps.push({
      label: 'Verificación',
      expression: `d/d${variable}[${formatExpression(antiderivative)}] = ${formatExpression(simplified)}`,
      description: isZero
        ? '✓ La derivada de la antiderivada coincide con el integrando original'
        : `⚠ La verificación no pudo confirmar exactitud (diferencia: ${formatExpression(diff)})`,
    })

    return isZero
  } catch {
    steps.push({
      label: 'Verificación',
      expression: 'No se pudo verificar',
      description: 'La verificación automática no está disponible para esta expresión',
    })
    return false
  }
}
