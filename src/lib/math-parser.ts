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
  // Algebrite uses "log" for natural log — display as "ln"
  s = s.replace(/\blog\(/g, 'ln(')

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

/** Extract the brace-balanced argument starting at position `start` (which should be '{') */
function extractBraceArg(s: string, start: number): { content: string; end: number } | null {
  if (s[start] !== '{') return null
  let depth = 0
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') {
      depth--
      if (depth === 0) return { content: s.slice(start + 1, i), end: i + 1 }
    }
  }
  return null
}

/** Convert MathLive LaTeX output to Algebrite-compatible syntax.
 *  Uses a proper brace-matching parser to handle nested structures like \frac{e^{2x}+1}{e^{2x}-1}
 */
export function latexToAlgebrite(latex: string): string {
  // Pre-clean: remove display-only commands and delimiters
  let s = latex
  s = s.replace(/^\$+|\$+$/g, '')               // strip $, $$, $$$ delimiters
  s = s.replace(/\\,|\\;|\\!|\\quad|\\qquad/g, '')
  s = s.replace(/\\ /g, ' ')
  s = s.replace(/\\left|\\right/g, '')
  s = s.replace(/\\operatorname\{([^}]*)\}/g, '$1')
  s = s.replace(/\\dfrac/g, '\\frac')            // \dfrac → \frac
  s = s.replace(/\\tfrac/g, '\\frac')            // \tfrac → \frac
  s = s.replace(/\\int\s*/g, '')
  s = s.replace(/\\,?d([a-z])\s*$/g, '')
  s = s.replace(/\s*d([a-z])\s*$/g, '')

  // Scan and convert
  let result = ''
  let i = 0
  while (i < s.length) {
    // --- \frac{num}{den} or \frac ab ---
    if (s.startsWith('\\frac', i)) {
      i += 5
      while (i < s.length && s[i] === ' ') i++
      let num: string, den: string
      if (s[i] === '{') {
        const a1 = extractBraceArg(s, i)
        if (a1) { num = a1.content; i = a1.end } else { num = '1'; }
        while (i < s.length && s[i] === ' ') i++
        if (s[i] === '{') {
          const a2 = extractBraceArg(s, i)
          if (a2) { den = a2.content; i = a2.end } else { den = s[i] || '1'; i++ }
        } else { den = s[i] || '1'; i++ }
      } else {
        num = s[i] || '1'; i++
        den = s[i] || '1'; i++
      }
      result += `(${latexToAlgebrite(num)})/(${latexToAlgebrite(den)})`
      continue
    }

    // --- \sqrt[n]{x} or \sqrt{x} ---
    if (s.startsWith('\\sqrt', i)) {
      i += 5
      if (s[i] === '[') {
        const cb = s.indexOf(']', i)
        if (cb !== -1) {
          const n = s.slice(i + 1, cb)
          i = cb + 1
          if (s[i] === '{') {
            const a = extractBraceArg(s, i)
            if (a) { result += `(${latexToAlgebrite(a.content)})^(1/(${latexToAlgebrite(n)}))`; i = a.end; continue }
          }
        }
      } else if (s[i] === '{') {
        const a = extractBraceArg(s, i)
        if (a) { result += `sqrt(${latexToAlgebrite(a.content)})`; i = a.end; continue }
      }
      continue
    }

    // --- Named LaTeX commands: \sin, \cos, \ln, \pi, etc ---
    if (s[i] === '\\') {
      const cmdMatch = s.slice(i).match(/^\\([a-zA-Z]+)/)
      if (cmdMatch) {
        const cmd = cmdMatch[1]
        const cmdLen = cmdMatch[0].length
        const funcMap: Record<string, string> = {
          sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
          arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan',
          sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
          ln: 'ln', log: 'log', exp: 'exp',
        }
        const constMap: Record<string, string> = {
          pi: 'pi', infty: 'inf', theta: 'theta', alpha: 'alpha', beta: 'beta',
          gamma: 'gamma', delta: 'delta', lambda: 'lambda', phi: 'phi',
          cdot: '*', times: '*', pm: '+-',
          lvert: 'abs(', rvert: ')',
        }
        if (funcMap[cmd]) { result += funcMap[cmd]; i += cmdLen; continue }
        if (constMap[cmd]) { result += constMap[cmd]; i += cmdLen; continue }
        // Unknown command — skip the backslash, keep the name
        result += cmd; i += cmdLen; continue
      }
      // Lone backslash — skip
      i++
      continue
    }

    // --- ^{exp} ---
    if (s[i] === '^' && i + 1 < s.length && s[i + 1] === '{') {
      const a = extractBraceArg(s, i + 1)
      if (a) { result += `^(${latexToAlgebrite(a.content)})`; i = a.end; continue }
    }

    // --- _{sub} ---
    if (s[i] === '_' && i + 1 < s.length && s[i + 1] === '{') {
      const a = extractBraceArg(s, i + 1)
      if (a) { result += a.content; i = a.end; continue }
    }

    // --- {content} plain braces → (content) ---
    if (s[i] === '{') {
      const a = extractBraceArg(s, i)
      if (a) { result += `(${latexToAlgebrite(a.content)})`; i = a.end; continue }
    }

    // --- |x| absolute value ---
    if (s[i] === '|') {
      const close = s.indexOf('|', i + 1)
      if (close !== -1) {
        result += `abs(${latexToAlgebrite(s.slice(i + 1, close))})`
        i = close + 1
        continue
      }
    }

    // Regular character
    result += s[i]
    i++
  }

  s = result

  // Implicit multiplication
  s = s.replace(/(\d)([a-zA-Z])/g, '$1*$2')
  s = s.replace(/\)\(/g, ')*(')
  s = s.replace(/\)([a-zA-Z])/g, ')*$1')

  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** Detect the integration variable from a LaTeX expression */
export function detectVariable(latex: string): string {
  // Check for dx, dt, dy, etc. at the end
  const dMatch = latex.match(/d([a-z])\s*$/)
  if (dMatch) return dMatch[1]

  // Find single-letter variables (excluding common function names and constants)
  const reserved = new Set(['e', 'd', 'i', 'n', 'k'])
  const funcNames = /sin|cos|tan|cot|sec|csc|log|ln|exp|abs|sqrt|lim|sum|int|frac|pi|inf|theta|alpha|beta|gamma|delta|epsilon|lambda|mu|sigma|omega|phi|arcsin|arccos|arctan/g
  const cleaned = latex.replace(/\\[a-zA-Z]+/g, '').replace(funcNames, '')
  const vars = cleaned.match(/\b([a-z])\b/g)
  if (vars) {
    for (const v of vars) {
      if (!reserved.has(v)) return v
    }
  }
  return 'x'
}

// ---------------------------------------------------------------------------
// Algebrite → LaTeX converter (for rendering results with MathLive)
// ---------------------------------------------------------------------------

/** Convert Algebrite/formatted expression to LaTeX for MathLive static rendering */
export function algebriteToLatex(expr: string): string {
  let s = expr

  // If it's already clean LaTeX (starts with \), just return
  if (/^\\[a-zA-Z]/.test(s.trim()) && !s.includes('∫') && !s.includes('→')) return s

  // --- Handle display-string symbols (from solver step formatting) ---
  s = s.replace(/→/g, '\\Rightarrow ')
  s = s.replace(/·/g, '\\cdot ')
  s = s.replace(/±/g, '\\pm ')

  // "dx", "dt" etc — only match specific differential patterns in integral context
  // Must be preceded by ) or a digit/variable, and only match single-letter vars (x, t, y, u, etc.)
  s = s.replace(/([)}\d])d([xyztuvw])(?:\s|$|[+\-=)])/g, (m, pre, v) => `${pre}\\,d${v}${m.slice(-1).match(/[+\-=)]/) ? m.slice(-1) : ' '}`)
  // Also match " dx" at end of integral expressions (space before d)
  s = s.replace(/\s+d([xyztuvw])(?:\s|$)/g, '\\,d$1 ')

  // Unicode symbols back to LaTeX
  s = s.replace(/π/g, '\\pi ')
  s = s.replace(/∞/g, '\\infty ')
  s = s.replace(/√\(/g, '\\sqrt{')
  s = s.replace(/∫/g, '\\int ')
  s = s.replace(/−/g, '-')

  // Unicode superscripts back to LaTeX exponents
  const supMap: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (match) => '^{' + [...match].map((c) => supMap[c] || c).join('') + '}')

  // --- Exponents FIRST (before fractions so ^(n+1) is consumed before /(n+1)) ---
  s = s.replace(/\*\*/g, '^') // ** is exponentiation in some CAS outputs
  s = s.replace(/\^\(([^()]*)\)/g, '^{$1}')  // x^(n+1) → x^{n+1}
  s = s.replace(/\^(\d+)/g, '^{$1}')          // x^2 → x^{2}

  // --- Fractions (after exponents are consumed) ---
  // Nested parens: (a)/(b) patterns
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, '\\frac{$1}{$2}')
  // Number or expression / (expr): -2/(x+1), 1/(x+1)
  s = s.replace(/(-?\d+)\/\(([^()]+)\)/g, '\\frac{$1}{$2}')
  // (expr)/number: (x+1)/3
  s = s.replace(/\(([^()]+)\)\/(\d+)/g, '\\frac{$1}{$2}')
  // After ^ exponent: x^{n+1}/(n+1) — standalone /(expr) as division
  s = s.replace(/\s*\/\s*\(([^()]+)\)/g, '\\cdot \\frac{1}{$1}')
  // Simple numeric fractions: 1/3, 3/2, etc.
  s = s.replace(/(?<![a-zA-Z^{])(\d+)\/(\d+)(?![a-zA-Z}])/g, '\\frac{$1}{$2}')

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
  // Algebrite uses "log" for natural log — display as ln
  s = s.replace(/\blog\b/g, '\\ln')
  s = s.replace(/\barcsin\b/g, '\\arcsin')
  s = s.replace(/\barccos\b/g, '\\arccos')
  s = s.replace(/\barctan\b/g, '\\arctan')

  // Constants
  s = s.replace(/\bpi\b/g, '\\pi')
  s = s.replace(/\binf\b/g, '\\infty')

  // Clean up multiplication: replace * with \cdot or remove for implicit multiplication
  s = s.replace(/([a-zA-Z0-9})])\*([a-zA-Z(\\])/g, '$1 \\cdot $2')
  // But for clean display, use implicit multiplication where natural
  s = s.replace(/(\d) \\cdot ([a-zA-Z])/g, '$1$2') // 3·x → 3x
  s = s.replace(/\) \\cdot \(/g, ')(') // )·( → )(
  s = s.replace(/\) \\cdot ([a-zA-Z])/g, ')$1') // )·x → )x
  s = s.replace(/([a-zA-Z}]) \\cdot \(/g, '$1(') // x·( → x(

  // Handle comma-separated assignments like "a=1, n=2"
  // Don't match \, (LaTeX thin space command)
  s = s.replace(/(?<!\\),\s*/g, ',\\; ')

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
