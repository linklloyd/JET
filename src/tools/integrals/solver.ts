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
    steps.push({
      label: 'Técnica identificada',
      expression: techniqueName(technique),
      description: techniqueDescription(technique),
    })

    // Step 3: Generate technique-specific steps
    let antiderivative: string
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
        antiderivative = solveDirect(expr, variable, steps)
        break
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

  // Auto-detect for indefinite/definite
  const s = expr.toLowerCase()

  // Check if it's a simple polynomial (power rule)
  if (isPolynomial(expr, variable)) return 'power-rule'

  // Check for product of different classes → by parts
  if (isProductOfClasses(expr, variable)) return 'by-parts'

  // Check for composite functions → u-substitution
  if (hasCompositeFunction(expr, variable)) return 'u-substitution'

  // Check for rational expression → partial fractions
  if (isRationalExpression(expr, variable)) return 'partial-fractions'

  // Check for trig patterns
  if (/\b(sin|cos|tan|sec|csc|cot)\b/.test(s)) return 'direct'

  return 'direct'
}

function isPolynomial(expr: string, variable: string): boolean {
  // A polynomial is terms of the form a*x^n connected by + or -
  // Remove spaces, check if it only contains: digits, variable, ^, +, -, *, /
  const cleaned = expr.replace(/\s/g, '')
  const v = variable
  // Simple heuristic: no trig, log, exp, sqrt functions
  if (/\b(sin|cos|tan|ln|log|exp|sqrt|sec|csc|cot)\b/.test(cleaned)) return false
  // Should contain the variable or be a constant
  const re = new RegExp(`^[\\d.+\\-*/^${v}()\\s]+$`)
  return re.test(cleaned)
}

function isProductOfClasses(expr: string, _variable: string): boolean {
  // Product of polynomial × trig/exp/log
  const hasPoly = /\b[a-z]\b/.test(expr) && /\^?\d/.test(expr)
  const hasTrigExpLog = /\b(sin|cos|tan|ln|log|exp|e\^)\b/.test(expr)
  const hasMultiplication = expr.includes('*') || (/\d[a-z]/.test(expr))
  return hasPoly && hasTrigExpLog && (hasMultiplication || true)
}

function hasCompositeFunction(_expr: string, _variable: string): boolean {
  // Functions with non-trivial arguments: sin(x^2), e^(3x), (2x+1)^5
  const funcPattern = /\b(sin|cos|tan|ln|log|exp)\([^)]*[+\-*/^][^)]*\)/
  const powerPattern = /\([^)]+\)\^\d/
  return funcPattern.test(_expr) || powerPattern.test(_expr)
}

function isRationalExpression(expr: string, _variable: string): boolean {
  // Contains division with polynomial in denominator
  return expr.includes('/') && /\([^)]*[a-z][^)]*\)/.test(expr)
}

// ---------------------------------------------------------------------------
// Technique names
// ---------------------------------------------------------------------------

function techniqueName(t: IntegrationTechnique): string {
  const names: Record<IntegrationTechnique, string> = {
    'power-rule': 'Regla de la potencia',
    'u-substitution': 'Sustitución (u-sub)',
    'by-parts': 'Integración por partes',
    'partial-fractions': 'Fracciones parciales',
    'trig-substitution': 'Sustitución trigonométrica',
    'trig-identity': 'Identidad trigonométrica',
    'direct': 'Integración directa',
    'sum-rule': 'Regla de la suma',
    'constant-multiple': 'Múltiplo constante',
  }
  return names[t]
}

function techniqueDescription(t: IntegrationTechnique): string {
  const desc: Record<IntegrationTechnique, string> = {
    'power-rule': 'Se aplica la regla ∫xⁿ dx = xⁿ⁺¹/(n+1) a cada término del polinomio',
    'u-substitution': 'Se identifica una sustitución u = g(x) para simplificar la integral',
    'by-parts': 'Se aplica ∫u dv = uv − ∫v du seleccionando u y dv según la regla LIATE',
    'partial-fractions': 'Se descompone la fracción racional en fracciones simples',
    'trig-substitution': 'Se usa una sustitución trigonométrica para eliminar la raíz',
    'trig-identity': 'Se aplica una identidad trigonométrica para simplificar',
    'direct': 'Se aplica la fórmula de integración directamente',
    'sum-rule': 'Se integra cada término por separado: ∫(f+g) = ∫f + ∫g',
    'constant-multiple': 'Se saca la constante: ∫cf dx = c∫f dx',
  }
  return desc[t]
}

// ---------------------------------------------------------------------------
// Power Rule solver
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

    if (terms.length > 1) {
      steps.push({
        label: 'Regla de la suma',
        expression: terms.map((t) => `∫(${formatExpression(t)}) d${variable}`).join(' + '),
        description: 'Se integra cada término por separado: ∫(f + g) = ∫f + ∫g',
      })
    }

    // Show the general formula
    steps.push({
      label: 'Fórmula',
      expression: `∫a${variable}^n d${variable} = a · ${variable}^(n+1) / (n+1)`,
      description: 'Se aplica la regla de la potencia a cada término',
    })

    // Integrate each term with formula substitution
    const integratedTerms: string[] = []
    for (const term of terms) {
      const termIntegral = cas.integral(term, variable)
      integratedTerms.push(termIntegral)

      // Extract coefficient and exponent for substitution display
      const { coeff, exp: n } = extractCoeffAndExponent(term, variable)
      const nPlus1 = n + 1

      if (n === 0) {
        steps.push({
          label: `Integrar: ${formatExpression(term)}`,
          expression: `∫(${coeff}) d${variable} = (${coeff})·${variable}`,
          description: `Constante: ∫a d${variable} = a·${variable}`,
          value: formatExpression(termIntegral),
        })
      } else {
        steps.push({
          label: `Integrar: ${formatExpression(term)}`,
          expression: `a=${coeff}, n=${n} → (${coeff})·${variable}^(${n}+1)/(${n}+1) = (${coeff})·${variable}^${nPlus1}/${nPlus1} = ${formatExpression(termIntegral)}`,
          description: `Sustituir a=${coeff}, n=${n} en la fórmula ∫a·${variable}^n d${variable} = a·${variable}^(n+1)/(n+1)`,
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
    return solveDirect(expr, variable, steps)
  }
}

/** Evaluate a CAS expression to a number (handles fractions like "1/2") */
function evalToNumber(expr: string): number {
  const n = parseFloat(expr)
  if (!isNaN(n)) return n
  // Try evaluating as float via CAS
  try {
    const f = cas.run(`float(${expr})`)
    return parseFloat(f) || 0
  } catch {
    return 0
  }
}

/** Extract coefficient and exponent from a term like 3*x^2, x, 5, etc. */
function extractCoeffAndExponent(term: string, variable: string): { coeff: string; exp: number } {
  const t = term.trim()

  // Pure constant (no variable)
  if (!t.includes(variable)) {
    return { coeff: t, exp: 0 }
  }

  try {
    const degree = cas.run(`deg(${t}, ${variable})`)
    const n = evalToNumber(degree)

    // Get coefficient as a string (preserves fractions like "1/2")
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

/** Split an expression into additive terms */
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
// Integration by Parts solver
// ---------------------------------------------------------------------------

function solveByParts(expr: string, variable: string, steps: IntegralStep[]): string {
  try {
    steps.push({
      label: 'Fórmula',
      expression: '∫u dv = uv − ∫v du',
      description: 'Se aplica la fórmula de integración por partes',
    })

    // Try to detect u and dv using LIATE priority
    // LIATE: Logarithmic, Inverse trig, Algebraic, Trigonometric, Exponential
    const { u, dv } = detectUAndDv(expr, variable)

    steps.push({
      label: 'Elegir u y dv (LIATE)',
      expression: `u = ${formatExpression(u)}    dv = ${formatExpression(dv)} d${variable}`,
      description: 'Se elige u según la regla LIATE: Logarítmica > Inversa trig > Algebraica > Trigonométrica > Exponencial',
    })

    // Compute du and v
    const du = cas.derivative(u, variable)
    const v = cas.integral(dv, variable)

    steps.push({
      label: 'Calcular du y v',
      expression: `du = ${formatExpression(du)} d${variable}    v = ${formatExpression(v)}`,
      description: `Se deriva u para obtener du, y se integra dv para obtener v`,
    })

    // Apply formula: uv - integral(v * du)
    const uvProduct = cas.simplify(`(${u}) * (${v})`)
    const remainingIntegrand = cas.simplify(`(${v}) * (${du})`)

    steps.push({
      label: 'Aplicar fórmula',
      expression: `${formatExpression(uvProduct)} − ∫(${formatExpression(remainingIntegrand)}) d${variable}`,
      description: 'Se sustituye en uv − ∫v du',
    })

    // Solve remaining integral
    const remainingIntegral = cas.integral(remainingIntegrand, variable)

    steps.push({
      label: 'Resolver integral restante',
      expression: `∫(${formatExpression(remainingIntegrand)}) d${variable} = ${formatExpression(remainingIntegral)}`,
      description: 'Se resuelve la integral restante',
    })

    // Final result
    const result = cas.simplify(`(${uvProduct}) - (${remainingIntegral})`)

    steps.push({
      label: 'Simplificar',
      expression: formatExpression(result),
      description: 'Se simplifica el resultado final',
    })

    return result
  } catch {
    return solveDirect(expr, variable, steps)
  }
}

function detectUAndDv(expr: string, variable: string): { u: string; dv: string } {
  // Simple heuristic: try to split the expression at the multiplication
  // and classify each factor by LIATE
  const s = expr.replace(/\s/g, '')

  // Try to find explicit multiplication
  // Common patterns: x*sin(x), x^2*exp(x), x*ln(x)
  const parts = splitAtMultiplication(s)

  if (parts.length >= 2) {
    // Classify each part
    const classified = parts.map((p) => ({ expr: p, priority: liatePriority(p, variable) }))
    classified.sort((a, b) => a.priority - b.priority) // lower = choose as u

    return {
      u: classified[0].expr,
      dv: classified.slice(1).map((c) => c.expr).join('*'),
    }
  }

  // Fallback: use the whole expression as dv, u=1 (not useful, but safe)
  // Better: try assuming the variable part is u
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
  if (/\bln\b|\blog\b/.test(s)) return 0     // Logarithmic
  if (/\basin\b|\bacos\b|\batan\b/.test(s)) return 1 // Inverse trig
  if (/^[0-9a-z^+\-*/.\s]+$/.test(s) && !/\b(sin|cos|tan|exp|e\^)\b/.test(s)) return 2 // Algebraic
  if (/\b(sin|cos|tan|sec|csc|cot)\b/.test(s)) return 3 // Trigonometric
  if (/\bexp\b|e\^/.test(s)) return 4         // Exponential
  return 2 // default: algebraic
}

// ---------------------------------------------------------------------------
// U-Substitution solver
// ---------------------------------------------------------------------------

function solveUSubstitution(expr: string, variable: string, steps: IntegralStep[]): string {
  try {
    // Use Algebrite to compute the integral (it handles substitution internally)
    const result = cas.integral(expr, variable)

    // Try to detect what substitution was used by looking for composite functions
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
    return solveDirect(expr, variable, steps)
  }
}

function detectInnerFunction(expr: string, variable: string): string | null {
  // Look for patterns like sin(EXPR), exp(EXPR), (EXPR)^n where EXPR contains the variable
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
    // Factor the denominator
    const factored = cas.run(`factor(${expr})`)

    steps.push({
      label: 'Factorizar',
      expression: formatExpression(factored),
      description: 'Se factoriza la expresión (especialmente el denominador)',
    })

    // Expand into partial fractions
    const expanded = cas.run(`partfrac(${expr}, ${variable})`)

    steps.push({
      label: 'Descomposición en fracciones parciales',
      expression: formatExpression(expanded),
      description: 'Se descompone en fracciones parciales',
    })

    // Integrate each fraction
    const result = cas.integral(expr, variable)
    const simplified = cas.simplify(result)

    steps.push({
      label: 'Integrar cada fracción',
      expression: formatExpression(simplified),
      description: 'Se integra cada fracción parcial por separado',
    })

    return simplified
  } catch {
    return solveDirect(expr, variable, steps)
  }
}

// ---------------------------------------------------------------------------
// Direct integration (fallback / for trig & simple functions)
// ---------------------------------------------------------------------------

function solveDirect(expr: string, variable: string, steps: IntegralStep[]): string {
  const result = cas.integral(expr, variable)
  const simplified = cas.simplify(result)

  steps.push({
    label: 'Integración directa',
    expression: `∫(${formatExpression(expr)}) d${variable} = ${formatExpression(simplified)}`,
    description: 'Se aplica la fórmula de integración correspondiente',
  })

  return simplified
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

  // Evaluate F(b)
  const fUpper = cas.run(`subst(${upper}, ${variable}, ${antiderivative})`)
  const fUpperVal = cas.run(`float(${fUpper})`)

  // Evaluate F(a)
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

  // Compute F(b) - F(a)
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
