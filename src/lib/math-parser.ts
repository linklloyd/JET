/* ─── Shared Math Parser & Formatter ─── */

// ---------------------------------------------------------------------------
// Symbol definitions for the virtual keyboard
// ---------------------------------------------------------------------------

export interface MathSymbol {
  display: string // What shows on the button
  insert: string  // What gets inserted into the input
}

export interface SymbolGroup {
  group: string
  symbols: MathSymbol[]
}

export const MATH_SYMBOLS: SymbolGroup[] = [
  {
    group: 'Operators',
    symbols: [
      { display: '+', insert: '+' },
      { display: '−', insert: '-' },
      { display: '×', insert: '*' },
      { display: '÷', insert: '/' },
      { display: '^', insert: '^' },
      { display: '(', insert: '(' },
      { display: ')', insert: ')' },
      { display: '=', insert: '=' },
    ],
  },
  {
    group: 'Functions',
    symbols: [
      { display: 'sin', insert: 'sin(' },
      { display: 'cos', insert: 'cos(' },
      { display: 'tan', insert: 'tan(' },
      { display: 'ln', insert: 'ln(' },
      { display: 'log', insert: 'log(' },
      { display: '√', insert: 'sqrt(' },
      { display: '|x|', insert: 'abs(' },
      { display: 'eˣ', insert: 'exp(' },
    ],
  },
  {
    group: 'Constants',
    symbols: [
      { display: 'π', insert: 'pi' },
      { display: 'e', insert: 'e' },
      { display: '∞', insert: 'inf' },
      { display: '−∞', insert: '-inf' },
    ],
  },
  {
    group: 'Calculus',
    symbols: [
      { display: '∫', insert: 'integral(' },
      { display: 'd/dx', insert: 'd(' },
      { display: 'x²', insert: '^2' },
      { display: 'x³', insert: '^3' },
      { display: 'xⁿ', insert: '^' },
      { display: '1/x', insert: '1/' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Normalize user-friendly input → CAS-compatible form
// ---------------------------------------------------------------------------

/** Convert user input to a form Algebrite can parse */
export function normalizeForCAS(input: string): string {
  let s = input.trim()

  // Unicode → ASCII
  s = s.replace(/π/g, 'pi')
  s = s.replace(/∞/g, 'inf')
  s = s.replace(/√/g, 'sqrt')
  s = s.replace(/×/g, '*')
  s = s.replace(/÷/g, '/')
  s = s.replace(/−/g, '-')

  // Unicode superscripts → ^n
  const superMap: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (match) => '^' + [...match].map((c) => superMap[c] || c).join(''))

  // Unicode subscripts → just digits (for variable names like x₁)
  const subMap: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (match) => [...match].map((c) => subMap[c] || c).join(''))

  // Implicit multiplication: 3x → 3*x, 2sin → 2*sin, )( → )*(, x( → x*(
  // digit followed by letter (not part of a function name)
  s = s.replace(/(\d)([a-zA-Z])/g, '$1*$2')
  // closing paren followed by opening paren or letter
  s = s.replace(/\)(\()/g, ')*(')
  s = s.replace(/\)([a-zA-Z])/g, ')*$1')
  // letter/closing-paren followed by opening paren (but not for functions)
  // Note: function calls like sin( remain correct because the digit→letter rule
  // inserts * between e.g. 2sin → 2*sin, but sin( stays as sin(

  return s
}

// ---------------------------------------------------------------------------
// Format CAS output → human-readable Unicode
// ---------------------------------------------------------------------------

const SUP_DIGITS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

/** Convert CAS-style expression to human-readable Unicode */
export function formatExpression(expr: string): string {
  let s = expr

  // Exponents: x^2 → x², x^12 → x¹², x^(n+1) → x^(n+1) (keep complex exponents)
  s = s.replace(/\^(\d+)/g, (_match, digits: string) => {
    return [...digits].map((d) => SUP_DIGITS[d] || d).join('')
  })

  // Common symbols
  s = s.replace(/\bpi\b/g, 'π')
  s = s.replace(/\binf\b/g, '∞')
  s = s.replace(/\bsqrt\(/g, '√(')

  // Clean up multiplication signs for display
  // Remove * between coefficient and variable: 3*x → 3x
  s = s.replace(/(\d)\*([a-zA-Z])/g, '$1$2')
  // Remove * between closing paren and opening paren or variable
  s = s.replace(/\)\*\(/g, ')(')
  s = s.replace(/\)\*([a-zA-Z])/g, ')$1')

  return s
}

// ---------------------------------------------------------------------------
// LaTeX → Algebrite converter (for MathLive output)
// ---------------------------------------------------------------------------

/** Convert MathLive LaTeX output to Algebrite-compatible syntax */
export function latexToAlgebrite(latex: string): string {
  let s = latex

  // Remove LaTeX whitespace commands
  s = s.replace(/\\,/g, '')
  s = s.replace(/\\;/g, '')
  s = s.replace(/\\!/g, '')
  s = s.replace(/\\quad/g, '')
  s = s.replace(/\\qquad/g, '')
  s = s.replace(/\\ /g, ' ')

  // Strip \left and \right
  s = s.replace(/\\left/g, '')
  s = s.replace(/\\right/g, '')

  // Integrals: \int → strip (solver handles integrals separately)
  s = s.replace(/\\int_?\{?[^}]*\}?\^?\{?[^}]*\}?\s*/g, '')
  s = s.replace(/\\int\s*/g, '')

  // dx, dt etc at the end
  s = s.replace(/\\,?d([a-z])$/g, '')
  s = s.replace(/\s*d([a-z])\s*$/g, '')

  // Fractions: \frac{a}{b} → (a)/(b)
  // Handle nested fractions by doing multiple passes
  for (let i = 0; i < 5; i++) {
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
  }

  // Square root: \sqrt{x} → sqrt(x), \sqrt[n]{x} → x^(1/n)
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^{}]*)\}/g, '($2)^(1/($1))')
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')

  // Powers: x^{2} → x^(2), handle multi-char exponents
  s = s.replace(/\^{([^{}]*)}/g, '^($1)')
  // Single char exponent without braces is fine: x^2

  // Subscripts: remove or convert (x_{1} → x1)
  s = s.replace(/_{([^{}]*)}/g, '$1')

  // Trig functions
  s = s.replace(/\\sin/g, 'sin')
  s = s.replace(/\\cos/g, 'cos')
  s = s.replace(/\\tan/g, 'tan')
  s = s.replace(/\\cot/g, 'cot')
  s = s.replace(/\\sec/g, 'sec')
  s = s.replace(/\\csc/g, 'csc')
  s = s.replace(/\\arcsin/g, 'arcsin')
  s = s.replace(/\\arccos/g, 'arccos')
  s = s.replace(/\\arctan/g, 'arctan')
  s = s.replace(/\\sinh/g, 'sinh')
  s = s.replace(/\\cosh/g, 'cosh')
  s = s.replace(/\\tanh/g, 'tanh')

  // Logarithms
  s = s.replace(/\\ln/g, 'ln')
  s = s.replace(/\\log/g, 'log')

  // Constants
  s = s.replace(/\\pi/g, 'pi')
  s = s.replace(/\\infty/g, 'inf')
  s = s.replace(/\\theta/g, 'theta')
  s = s.replace(/\\alpha/g, 'alpha')
  s = s.replace(/\\beta/g, 'beta')

  // Exponential: e^{x} → exp(x) — only when it's Euler's e
  s = s.replace(/\\exp/g, 'exp')

  // Multiplication: \cdot and \times → *
  s = s.replace(/\\cdot/g, '*')
  s = s.replace(/\\times/g, '*')

  // Absolute value: |x| or \lvert x \rvert
  s = s.replace(/\\lvert/g, 'abs(')
  s = s.replace(/\\rvert/g, ')')
  s = s.replace(/\|([^|]+)\|/g, 'abs($1)')

  // Remove remaining backslash commands that are just display
  s = s.replace(/\\operatorname\{([^}]*)\}/g, '$1')

  // Clean up braces that are just grouping
  s = s.replace(/\{([^{}]*)\}/g, '($1)')

  // Implicit multiplication: 2x → 2*x, )(  → )*(
  s = s.replace(/(\d)([a-zA-Z])/g, '$1*$2')
  s = s.replace(/\)\(/g, ')*(')
  s = s.replace(/\)([a-zA-Z])/g, ')*$1')

  // Clean up multiple spaces
  s = s.replace(/\s+/g, ' ').trim()

  return s
}

// ---------------------------------------------------------------------------
// Algebrite → LaTeX converter (for rendering results with MathLive)
// ---------------------------------------------------------------------------

/** Convert Algebrite/formatted expression to LaTeX for MathLive static rendering */
export function algebriteToLatex(expr: string): string {
  let s = expr

  // Unicode symbols back to LaTeX
  s = s.replace(/π/g, '\\pi ')
  s = s.replace(/∞/g, '\\infty ')
  s = s.replace(/√\(/g, '\\sqrt{')
  // Fix sqrt closing: find matching paren after sqrt
  s = s.replace(/∫/g, '\\int ')
  s = s.replace(/−/g, '-')

  // Unicode superscripts back to LaTeX exponents
  const supMap: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (match) => '^{' + [...match].map((c) => supMap[c] || c).join('') + '}')

  // Fractions: (a)/(b) patterns
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, '\\frac{$1}{$2}')

  // Simple numeric fractions: 1/3, 3/2, etc (not inside larger expressions)
  s = s.replace(/(\d+)\/(\d+)/g, '\\frac{$1}{$2}')

  // sqrt(x) → \sqrt{x}
  s = s.replace(/sqrt\(([^()]*)\)/g, '\\sqrt{$1}')

  // Trig functions
  s = s.replace(/\bsin\b/g, '\\sin')
  s = s.replace(/\bcos\b/g, '\\cos')
  s = s.replace(/\btan\b/g, '\\tan')
  s = s.replace(/\bcot\b/g, '\\cot')
  s = s.replace(/\bsec\b/g, '\\sec')
  s = s.replace(/\bcsc\b/g, '\\csc')
  s = s.replace(/\bln\b/g, '\\ln')
  s = s.replace(/\blog\b/g, '\\log')
  s = s.replace(/\barcsin\b/g, '\\arcsin')
  s = s.replace(/\barccos\b/g, '\\arccos')
  s = s.replace(/\barctan\b/g, '\\arctan')

  // Constants
  s = s.replace(/\bpi\b/g, '\\pi')
  s = s.replace(/\binf\b/g, '\\infty')

  // Exponents: x^2 → x^{2}, x^(n+1) → x^{n+1}
  s = s.replace(/\^(\d+)/g, '^{$1}')
  s = s.replace(/\^\(([^()]*)\)/g, '^{$1}')

  // Clean up multiplication: remove * between terms for display
  s = s.replace(/(\d)\*([a-zA-Z\\])/g, '$1$2')
  s = s.replace(/\)\*\(/g, ')(')
  s = s.replace(/\)\*([a-zA-Z\\])/g, ')$1')

  return s
}

// ---------------------------------------------------------------------------
// Expression validation
// ---------------------------------------------------------------------------

/** Basic validation of a math expression */
export function validateExpression(input: string): string | null {
  if (!input.trim()) return 'Expression is empty'

  // Check balanced parentheses
  let depth = 0
  for (const ch of input) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth < 0) return 'Unbalanced parentheses'
  }
  if (depth !== 0) return 'Unbalanced parentheses'

  return null // valid
}
