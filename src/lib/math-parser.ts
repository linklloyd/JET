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
