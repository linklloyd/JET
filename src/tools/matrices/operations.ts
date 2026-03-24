import type { Matrix, Step, OperationResult, SystemResult, CramerTab, EchelonTarget, DeterminantMethod, InverseMethod, SystemMethod } from './types'

// ─── Utilities ──────────────────────────────────────────────────────────

export function cloneMatrix(m: Matrix): Matrix {
  return m.map(row => [...row])
}

export function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  // Show fractions nicely
  const abs = Math.abs(n)
  for (let d = 1; d <= 1000; d++) {
    const num = abs * d
    if (Math.abs(num - Math.round(num)) < 1e-9) {
      const sign = n < 0 ? '-' : ''
      const rNum = Math.round(num)
      if (d === 1) return `${sign}${rNum}`
      return `${sign}${rNum}/${d}`
    }
  }
  return n.toFixed(4)
}

export function createZeroMatrix(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array(cols).fill(0))
}

export function identityMatrix(n: number): Matrix {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  )
}

function matrixToString(m: Matrix): string {
  return m.map(row => '[ ' + row.map(fmtNum).join('  ') + ' ]').join('\n')
}

function describeMatrix(label: string, m: Matrix): string {
  return `${label}:\n${matrixToString(m)}`
}

// ─── Multiplication ─────────────────────────────────────────────────────

export function multiply(a: Matrix, b: Matrix): OperationResult {
  const m = a.length
  const n = a[0].length
  const p = b[0].length
  const steps: Step[] = []

  if (n !== b.length) {
    throw new Error(`No se puede multiplicar: columnas de A (${n}) ≠ filas de B (${b.length})`)
  }

  steps.push({
    label: 'Matrices de entrada',
    description: `${describeMatrix('A (' + m + '×' + n + ')', a)}\n\n${describeMatrix('B (' + b.length + '×' + p + ')', b)}`,
  })

  steps.push({
    label: 'Dimensiones',
    description: `A(${m}×${n}) × B(${b.length}×${p}) = C(${m}×${p})\nCada elemento c_ij = Σ(a_ik × b_kj) para k=1..${n}`,
  })

  const result = createZeroMatrix(m, p)
  const cellCalcs: string[] = []

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0
      const terms: string[] = []
      for (let k = 0; k < n; k++) {
        terms.push(`(${fmtNum(a[i][k])})(${fmtNum(b[k][j])})`)
        sum += a[i][k] * b[k][j]
      }
      result[i][j] = sum
      cellCalcs.push(`c_${i + 1}${j + 1} = ${terms.join(' + ')} = ${fmtNum(sum)}`)
    }
  }

  steps.push({
    label: 'Cálculo elemento por elemento',
    description: cellCalcs.join('\n'),
    matrix: cloneMatrix(result),
  })

  // Verification: show result
  steps.push({
    label: 'Resultado C = A × B',
    description: matrixToString(result),
    matrix: cloneMatrix(result),
  })

  return { result, steps }
}

// ─── Echelon Forms ──────────────────────────────────────────────────────

export function echelon(matrix: Matrix, target: EchelonTarget): OperationResult {
  const m = cloneMatrix(matrix)
  const rows = m.length
  const cols = m[0].length
  const steps: Step[] = []

  steps.push({
    label: 'Matriz original',
    description: matrixToString(matrix),
    matrix: cloneMatrix(matrix),
  })

  if (target === 'upper' || target === 'identity') {
    // Forward elimination → upper triangular
    for (let col = 0; col < Math.min(rows, cols); col++) {
      // Find pivot
      let pivotRow = -1
      for (let r = col; r < rows; r++) {
        if (Math.abs(m[r][col]) > 1e-12) { pivotRow = r; break }
      }
      if (pivotRow === -1) continue

      if (pivotRow !== col) {
        [m[col], m[pivotRow]] = [m[pivotRow], m[col]]
        steps.push({
          label: `Intercambio F${col + 1} ↔ F${pivotRow + 1}`,
          description: `Se intercambian las filas ${col + 1} y ${pivotRow + 1} para colocar el pivote`,
          matrix: cloneMatrix(m),
        })
      }

      const pivot = m[col][col]
      for (let r = col + 1; r < rows; r++) {
        if (Math.abs(m[r][col]) < 1e-12) continue
        const factor = m[r][col] / pivot
        for (let c = col; c < cols; c++) {
          m[r][c] -= factor * m[col][c]
          if (Math.abs(m[r][c]) < 1e-12) m[r][c] = 0
        }
        steps.push({
          label: `F${r + 1} → F${r + 1} - (${fmtNum(factor)})F${col + 1}`,
          description: `Se elimina el elemento en la posición (${r + 1},${col + 1})`,
          matrix: cloneMatrix(m),
        })
      }
    }

    if (target === 'upper') {
      steps.push({
        label: 'Resultado: Triangular superior',
        description: matrixToString(m),
        matrix: cloneMatrix(m),
      })
      return { result: m, steps }
    }
  }

  if (target === 'lower') {
    // Backward elimination → lower triangular
    for (let col = Math.min(rows, cols) - 1; col >= 0; col--) {
      let pivotRow = -1
      for (let r = col; r >= 0; r--) {
        if (Math.abs(m[r][col]) > 1e-12) { pivotRow = r; break }
      }
      if (pivotRow === -1) continue

      if (pivotRow !== col) {
        [m[col], m[pivotRow]] = [m[pivotRow], m[col]]
        steps.push({
          label: `Intercambio F${col + 1} ↔ F${pivotRow + 1}`,
          description: `Se intercambian las filas ${col + 1} y ${pivotRow + 1}`,
          matrix: cloneMatrix(m),
        })
      }

      const pivot = m[col][col]
      for (let r = col - 1; r >= 0; r--) {
        if (Math.abs(m[r][col]) < 1e-12) continue
        const factor = m[r][col] / pivot
        for (let c = 0; c < cols; c++) {
          m[r][c] -= factor * m[col][c]
          if (Math.abs(m[r][c]) < 1e-12) m[r][c] = 0
        }
        steps.push({
          label: `F${r + 1} → F${r + 1} - (${fmtNum(factor)})F${col + 1}`,
          description: `Se elimina el elemento en la posición (${r + 1},${col + 1})`,
          matrix: cloneMatrix(m),
        })
      }
    }

    steps.push({
      label: 'Resultado: Triangular inferior',
      description: matrixToString(m),
      matrix: cloneMatrix(m),
    })
    return { result: m, steps }
  }

  // target === 'identity': continue from upper triangular to RREF
  // Back-substitution
  for (let col = Math.min(rows, cols) - 1; col >= 0; col--) {
    if (Math.abs(m[col][col]) < 1e-12) continue

    // Normalize pivot row
    const pivot = m[col][col]
    if (Math.abs(pivot - 1) > 1e-12) {
      for (let c = 0; c < cols; c++) {
        m[col][c] /= pivot
        if (Math.abs(m[col][c]) < 1e-12) m[col][c] = 0
      }
      steps.push({
        label: `F${col + 1} → F${col + 1} / ${fmtNum(pivot)}`,
        description: `Se normaliza la fila ${col + 1} dividiendo entre ${fmtNum(pivot)}`,
        matrix: cloneMatrix(m),
      })
    }

    // Eliminate above
    for (let r = col - 1; r >= 0; r--) {
      if (Math.abs(m[r][col]) < 1e-12) continue
      const factor = m[r][col]
      for (let c = 0; c < cols; c++) {
        m[r][c] -= factor * m[col][c]
        if (Math.abs(m[r][c]) < 1e-12) m[r][c] = 0
      }
      steps.push({
        label: `F${r + 1} → F${r + 1} - (${fmtNum(factor)})F${col + 1}`,
        description: `Se elimina el elemento en la posición (${r + 1},${col + 1})`,
        matrix: cloneMatrix(m),
      })
    }
  }

  steps.push({
    label: 'Resultado: Forma escalonada reducida (identidad)',
    description: matrixToString(m),
    matrix: cloneMatrix(m),
  })

  return { result: m, steps }
}

// ─── Inverse ────────────────────────────────────────────────────────────

export function inverse(matrix: Matrix, method: InverseMethod): OperationResult {
  const n = matrix.length
  if (n !== matrix[0].length) throw new Error('La matriz debe ser cuadrada')

  if (method === 'cofactors') return inverseByCofactors(matrix)
  return inverseByGaussJordan(matrix)
}

function inverseByGaussJordan(matrix: Matrix): OperationResult {
  const n = matrix.length
  const steps: Step[] = []

  // Build augmented matrix [A | I]
  const aug: Matrix = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ])

  steps.push({
    label: 'Matriz aumentada [A | I]',
    description: matrixToString(aug),
    matrix: cloneMatrix(aug),
    separatorCol: n,
  })

  // Forward elimination
  for (let col = 0; col < n; col++) {
    let pivotRow = -1
    for (let r = col; r < n; r++) {
      if (Math.abs(aug[r][col]) > 1e-12) { pivotRow = r; break }
    }
    if (pivotRow === -1) throw new Error('La matriz es singular (no tiene inversa)')

    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]]
      steps.push({
        label: `Intercambio F${col + 1} ↔ F${pivotRow + 1}`,
        description: `Intercambio de filas para obtener pivote no nulo`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }

    const pivot = aug[col][col]
    if (Math.abs(pivot - 1) > 1e-12) {
      for (let c = 0; c < 2 * n; c++) {
        aug[col][c] /= pivot
        if (Math.abs(aug[col][c]) < 1e-12) aug[col][c] = 0
      }
      steps.push({
        label: `F${col + 1} → F${col + 1} / ${fmtNum(pivot)}`,
        description: `Normalizar fila ${col + 1}`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }

    for (let r = 0; r < n; r++) {
      if (r === col || Math.abs(aug[r][col]) < 1e-12) continue
      const factor = aug[r][col]
      for (let c = 0; c < 2 * n; c++) {
        aug[r][c] -= factor * aug[col][c]
        if (Math.abs(aug[r][c]) < 1e-12) aug[r][c] = 0
      }
      steps.push({
        label: `F${r + 1} → F${r + 1} - (${fmtNum(factor)})F${col + 1}`,
        description: `Eliminar elemento (${r + 1},${col + 1})`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }
  }

  // Extract inverse
  const inv = aug.map(row => row.slice(n))

  steps.push({
    label: 'Resultado: A⁻¹',
    description: matrixToString(inv),
    matrix: cloneMatrix(inv),
  })

  // Verification: A × A⁻¹ = I
  const verif = multiplyRaw(matrix, inv)
  const verifSteps: Step[] = [{
    label: 'Comprobación: A × A⁻¹',
    description: `${describeMatrix('A', matrix)}\n\n×\n\n${describeMatrix('A⁻¹', inv)}\n\n=\n\n${matrixToString(verif)}`,
    matrix: verif,
  }]

  return {
    result: inv,
    steps,
    verification: verif,
    verificationSteps: verifSteps,
    extra: { augmented: aug },
  }
}

function inverseByCofactors(matrix: Matrix): OperationResult {
  const n = matrix.length
  const steps: Step[] = []

  steps.push({
    label: 'Matriz original',
    description: matrixToString(matrix),
    matrix: cloneMatrix(matrix),
  })

  // Calculate determinant
  const det = determinantValue(matrix)
  steps.push({
    label: '|A|',
    description: `|A| = ${fmtNum(det)}`,
  })

  if (Math.abs(det) < 1e-12) throw new Error('|A| = 0, la matriz es singular (no tiene inversa)')

  // Cofactor matrix
  const cof = createZeroMatrix(n, n)
  const cofCalcs: string[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const minor = getMinor(matrix, i, j)
      const minorDet = determinantValue(minor)
      cof[i][j] = Math.pow(-1, i + j) * minorDet
      if (Math.abs(cof[i][j]) < 1e-12) cof[i][j] = 0
      cofCalcs.push(`C${sub((i + 1) * 10 + (j + 1))} = (-1)${sup(i + j)} × |M${sub((i + 1) * 10 + (j + 1))}| = ${fmtNum(cof[i][j])}`)
    }
  }

  steps.push({
    label: 'Matriz de cofactores',
    description: cofCalcs.join('\n') + '\n\n' + matrixToString(cof),
    matrix: cloneMatrix(cof),
  })

  // Adjugate (transpose of cofactor)
  const adj = createZeroMatrix(n, n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      adj[i][j] = cof[j][i]

  steps.push({
    label: 'Adj(A) = Cofactores^T',
    description: matrixToString(adj),
    matrix: cloneMatrix(adj),
  })

  // Inverse = (1/det) × adj
  const inv = adj.map(row => row.map(v => {
    const r = v / det
    return Math.abs(r) < 1e-12 ? 0 : r
  }))

  steps.push({
    label: `A⁻¹ = (1/|A|) × Adj(A) = (1/${fmtNum(det)}) × Adj(A)`,
    description: matrixToString(inv),
    matrix: cloneMatrix(inv),
  })

  // Verification
  const verif = multiplyRaw(matrix, inv)
  const verifSteps: Step[] = [{
    label: 'Comprobación: A × A⁻¹',
    description: `${describeMatrix('A', matrix)}\n\n×\n\n${describeMatrix('A⁻¹', inv)}\n\n=\n\n${matrixToString(verif)}`,
    matrix: verif,
  }]

  return {
    result: inv,
    steps,
    verification: verif,
    verificationSteps: verifSteps,
  }
}

// ─── Determinant ────────────────────────────────────────────────────────

function getMinor(m: Matrix, row: number, col: number): Matrix {
  return m
    .filter((_, i) => i !== row)
    .map(r => r.filter((_, j) => j !== col))
}

function determinantValue(m: Matrix): number {
  const n = m.length
  if (n === 1) return m[0][0]
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0]

  let det = 0
  for (let j = 0; j < n; j++) {
    det += Math.pow(-1, j) * m[0][j] * determinantValue(getMinor(m, 0, j))
  }
  return det
}

// Unicode subscript & superscript digits
const SUB_DIGITS = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉']
const SUP_DIGITS = ['⁰','¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹']
function sub(n: number): string {
  return String(n).split('').map(d => SUB_DIGITS[+d]).join('')
}
function sup(n: number): string {
  return String(n).split('').map(d => SUP_DIGITS[+d]).join('')
}

export function determinant(matrix: Matrix, method: DeterminantMethod, expansionType: 'row' | 'col' = 'row', expansionIndex = 0): OperationResult {
  const n = matrix.length
  if (n !== matrix[0].length) throw new Error('La matriz debe ser cuadrada')

  if (method === 'sarrus') {
    if (n !== 3) throw new Error('El método de Sarrus solo aplica para matrices 3×3')
    return determinantSarrus(matrix)
  }
  if (method === 'row-expansion') return determinantByExpansion(matrix, expansionType, expansionIndex)
  return determinantByTriangular(matrix)
}

function determinantSarrus(matrix: Matrix): OperationResult {
  const m = matrix
  const steps: Step[] = []

  steps.push({
    label: 'Matriz 3×3',
    description: matrixToString(m),
    matrix: cloneMatrix(m),
  })

  const diag1 = m[0][0] * m[1][1] * m[2][2]
  const diag2 = m[0][1] * m[1][2] * m[2][0]
  const diag3 = m[0][2] * m[1][0] * m[2][1]
  const anti1 = m[0][2] * m[1][1] * m[2][0]
  const anti2 = m[0][1] * m[1][0] * m[2][2]
  const anti3 = m[0][0] * m[1][2] * m[2][1]

  steps.push({
    label: 'Diagonales principales (+)',
    description: [
      `a${sub(11)}·a${sub(22)}·a${sub(33)} = (${fmtNum(m[0][0])})(${fmtNum(m[1][1])})(${fmtNum(m[2][2])}) = ${fmtNum(diag1)}`,
      `a${sub(12)}·a${sub(23)}·a${sub(31)} = (${fmtNum(m[0][1])})(${fmtNum(m[1][2])})(${fmtNum(m[2][0])}) = ${fmtNum(diag2)}`,
      `a${sub(13)}·a${sub(21)}·a${sub(32)} = (${fmtNum(m[0][2])})(${fmtNum(m[1][0])})(${fmtNum(m[2][1])}) = ${fmtNum(diag3)}`,
    ].join('\n'),
  })

  steps.push({
    label: 'Diagonales secundarias (-)',
    description: [
      `a${sub(13)}·a${sub(22)}·a${sub(31)} = (${fmtNum(m[0][2])})(${fmtNum(m[1][1])})(${fmtNum(m[2][0])}) = ${fmtNum(anti1)}`,
      `a${sub(12)}·a${sub(21)}·a${sub(33)} = (${fmtNum(m[0][1])})(${fmtNum(m[1][0])})(${fmtNum(m[2][2])}) = ${fmtNum(anti2)}`,
      `a${sub(11)}·a${sub(23)}·a${sub(32)} = (${fmtNum(m[0][0])})(${fmtNum(m[1][2])})(${fmtNum(m[2][1])}) = ${fmtNum(anti3)}`,
    ].join('\n'),
  })

  const det = diag1 + diag2 + diag3 - anti1 - anti2 - anti3

  steps.push({
    label: '|A|',
    description: `|A| = (${fmtNum(diag1)} + ${fmtNum(diag2)} + ${fmtNum(diag3)}) - (${fmtNum(anti1)} + ${fmtNum(anti2)} + ${fmtNum(anti3)})\n|A| = ${fmtNum(diag1 + diag2 + diag3)} - ${fmtNum(anti1 + anti2 + anti3)} = ${fmtNum(det)}`,
  })

  return { result: [[det]], steps }
}

function determinantByExpansion(matrix: Matrix, expandBy: 'row' | 'col' = 'row', idx = 0): OperationResult {
  const n = matrix.length
  const steps: Step[] = []

  steps.push({
    label: 'Matriz original',
    description: matrixToString(matrix),
    matrix: cloneMatrix(matrix),
  })

  if (n === 1) {
    steps.push({ label: '|A| (1×1)', description: `|A| = a${sub(11)} = ${fmtNum(matrix[0][0])}` })
    return { result: [[matrix[0][0]]], steps }
  }

  if (n === 2) {
    const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]
    steps.push({
      label: '|A| (2×2)',
      description: `|A| = a${sub(11)}·a${sub(22)} - a${sub(12)}·a${sub(21)}\n|A| = (${fmtNum(matrix[0][0])})(${fmtNum(matrix[1][1])}) - (${fmtNum(matrix[0][1])})(${fmtNum(matrix[1][0])}) = ${fmtNum(det)}`,
    })
    return { result: [[det]], steps }
  }

  const isRow = expandBy === 'row'
  steps.push({
    label: `Expansión por ${isRow ? 'renglón' : 'columna'} ${idx + 1}`,
    description: `|A| = Σ (-1)ⁱ⁺ʲ · a${isRow ? `${sub((idx + 1) * 10)}ⱼ` : `ᵢ${sub(idx + 1)}`} · |M${isRow ? `${sub((idx + 1) * 10)}ⱼ` : `ᵢ${sub(idx + 1)}`}|`,
  })

  let det = 0
  const terms: string[] = []
  const count = n

  for (let k = 0; k < count; k++) {
    const i = isRow ? idx : k
    const j = isRow ? k : idx
    const sign = Math.pow(-1, i + j)
    const minor = getMinor(matrix, i, j)
    const minorDet = determinantValue(minor)
    const contribution = sign * matrix[i][j] * minorDet
    const ri = i + 1
    const ci = j + 1

    const minorLabel = `M${sub(ri * 10 + ci)}`
    const minorLines = matrixToString(minor).split('\n')
    const minorFormatted = minorLines.map((line, li) =>
      li === 0 ? `  ${minorLabel} = ${line}` : `  ${' '.repeat(minorLabel.length + 3)}${line}`
    ).join('\n')

    terms.push(
      `${sign > 0 ? '+' : '-'} a${sub(ri * 10 + ci)} · ${minorLabel}\n` +
      `  a${sub(ri * 10 + ci)} = ${fmtNum(matrix[i][j])}\n` +
      minorFormatted + '\n' +
      `  |${minorLabel}| = ${fmtNum(minorDet)}\n` +
      `  Contribución: (${fmtNum(sign)})(${fmtNum(matrix[i][j])})(${fmtNum(minorDet)}) = ${fmtNum(contribution)}`
    )

    det += contribution
  }

  steps.push({
    label: 'Cálculo de cofactores',
    description: terms.join('\n\n'),
  })

  steps.push({
    label: '|A|',
    description: `|A| = ${fmtNum(det)}`,
  })

  return { result: [[det]], steps }
}

function determinantByTriangular(matrix: Matrix): OperationResult {
  const m = cloneMatrix(matrix)
  const n = m.length
  const steps: Step[] = []
  let swaps = 0

  steps.push({
    label: 'Matriz original',
    description: matrixToString(matrix),
    matrix: cloneMatrix(matrix),
  })

  steps.push({
    label: 'Método',
    description: 'Reducir a triangular superior. |A| = (-1)ˢ × Π(pivotes), donde s = número de intercambios',
  })

  for (let col = 0; col < n; col++) {
    let pivotRow = -1
    for (let r = col; r < n; r++) {
      if (Math.abs(m[r][col]) > 1e-12) { pivotRow = r; break }
    }
    if (pivotRow === -1) {
      steps.push({ label: 'Columna sin pivote', description: `Columna ${col + 1} es cero → |A| = 0` })
      return { result: [[0]], steps }
    }

    if (pivotRow !== col) {
      [m[col], m[pivotRow]] = [m[pivotRow], m[col]]
      swaps++
      steps.push({
        label: `Intercambio F${col + 1} ↔ F${pivotRow + 1}`,
        description: `Intercambio #${swaps}`,
        matrix: cloneMatrix(m),
      })
    }

    const pivot = m[col][col]
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) < 1e-12) continue
      const factor = m[r][col] / pivot
      for (let c = col; c < n; c++) {
        m[r][c] -= factor * m[col][c]
        if (Math.abs(m[r][c]) < 1e-12) m[r][c] = 0
      }
      steps.push({
        label: `F${r + 1} → F${r + 1} - (${fmtNum(factor)})F${col + 1}`,
        description: `Eliminar posición (${r + 1},${col + 1})`,
        matrix: cloneMatrix(m),
      })
    }
  }

  const diagProduct = m.reduce((acc, row, i) => acc * row[i], 1)
  const det = Math.pow(-1, swaps) * diagProduct

  steps.push({
    label: 'Triangular superior',
    description: matrixToString(m),
    matrix: cloneMatrix(m),
  })

  const pivots = m.map((row, i) => fmtNum(row[i])).join(' × ')
  steps.push({
    label: '|A|',
    description: `|A| = (-1)${sup(swaps)} × (${pivots}) = ${fmtNum(det)}`,
  })

  return { result: [[det]], steps }
}

// ─── Cofactors ──────────────────────────────────────────────────────────

export function cofactors(matrix: Matrix): OperationResult {
  const n = matrix.length
  if (n !== matrix[0].length) throw new Error('La matriz debe ser cuadrada')

  const steps: Step[] = []

  steps.push({
    label: 'Matriz original A',
    description: matrixToString(matrix),
    matrix: cloneMatrix(matrix),
  })

  // Cofactor matrix B
  const B = createZeroMatrix(n, n)
  const calcs: string[] = []

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const minor = getMinor(matrix, i, j)
      const minorDet = determinantValue(minor)
      B[i][j] = Math.pow(-1, i + j) * minorDet
      if (Math.abs(B[i][j]) < 1e-12) B[i][j] = 0
      const mLabel = `M${sub((i + 1) * 10 + (j + 1))}`
      const mLines = matrixToString(minor).split('\n')
      const mFormatted = mLines.map((line, li) =>
        li === 0 ? `  ${mLabel} = ${line}` : `  ${' '.repeat(mLabel.length + 3)}${line}`
      ).join('\n')
      calcs.push(
        `B${sub((i + 1) * 10 + (j + 1))} = (-1)${sup(i + j)} × |${mLabel}|\n` +
        mFormatted + '\n' +
        `  |${mLabel}| = ${fmtNum(minorDet)}\n` +
        `  B${sub((i + 1) * 10 + (j + 1))} = ${fmtNum(B[i][j])}`
      )
    }
  }

  steps.push({
    label: 'Cálculo de cofactores',
    description: calcs.join('\n'),
  })

  steps.push({
    label: 'Matriz de cofactores B',
    description: matrixToString(B),
    matrix: cloneMatrix(B),
  })

  // Adjugate
  const adj = createZeroMatrix(n, n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      adj[i][j] = B[j][i]

  steps.push({
    label: 'Adj(B) = B^T (Transpuesta de cofactores)',
    description: matrixToString(adj),
    matrix: cloneMatrix(adj),
  })

  return { result: B, steps, extra: { adjugate: adj } }
}

// ─── Systems of Equations ───────────────────────────────────────────────

function multiplyRaw(a: Matrix, b: Matrix): Matrix {
  const m = a.length
  const p = b[0].length
  const n = a[0].length
  const result = createZeroMatrix(m, p)
  for (let i = 0; i < m; i++)
    for (let j = 0; j < p; j++)
      for (let k = 0; k < n; k++)
        result[i][j] += a[i][k] * b[k][j]
  // Clean near-zero
  for (let i = 0; i < m; i++)
    for (let j = 0; j < p; j++)
      if (Math.abs(result[i][j]) < 1e-9) result[i][j] = 0
  return result
}

export function solveSystem(
  coefficients: Matrix,
  constants: number[],
  method: SystemMethod,
  variables: string[]
): SystemResult {
  const n = coefficients.length
  if (n !== coefficients[0].length) throw new Error('El sistema debe ser cuadrado (n ecuaciones, n incógnitas)')

  switch (method) {
    case 'gaussian': return gaussianElimination(coefficients, constants, variables)
    case 'gauss-jordan': return gaussJordan(coefficients, constants, variables)
    case 'montante': return montante(coefficients, constants, variables)
    case 'cramer': return cramer(coefficients, constants, variables)
  }
}

function buildAugmented(coeff: Matrix, constants: number[]): Matrix {
  return coeff.map((row, i) => [...row, constants[i]])
}

function gaussianElimination(coeff: Matrix, constants: number[], variables: string[]): SystemResult {
  const n = coeff.length
  const aug = buildAugmented(coeff, constants)
  const steps: Step[] = []

  steps.push({
    label: 'Matriz aumentada [A|b]',
    description: matrixToString(aug),
    matrix: cloneMatrix(aug),
    separatorCol: n,
  })

  // Forward elimination
  for (let col = 0; col < n; col++) {
    let pivotRow = -1
    for (let r = col; r < n; r++) {
      if (Math.abs(aug[r][col]) > 1e-12) { pivotRow = r; break }
    }
    if (pivotRow === -1) throw new Error('El sistema no tiene solución única')

    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]]
      steps.push({
        label: `Intercambio F${col + 1} ↔ F${pivotRow + 1}`,
        description: `Colocar pivote en posición (${col + 1},${col + 1})`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }

    // Normalize pivot row to make leading element = 1
    const pivot = aug[col][col]
    if (Math.abs(pivot - 1) > 1e-12) {
      for (let c = col; c <= n; c++) {
        aug[col][c] /= pivot
        if (Math.abs(aug[col][c]) < 1e-12) aug[col][c] = 0
      }
      steps.push({
        label: `F${col + 1} → F${col + 1} / ${fmtNum(pivot)}`,
        description: `Convertir pivote (${col + 1},${col + 1}) en 1`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }

    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) < 1e-12) continue
      const factor = aug[r][col]
      for (let c = col; c <= n; c++) {
        aug[r][c] -= factor * aug[col][c]
        if (Math.abs(aug[r][c]) < 1e-12) aug[r][c] = 0
      }
      steps.push({
        label: `F${r + 1} → F${r + 1} - (${fmtNum(factor)})F${col + 1}`,
        description: `Eliminar ${variables[col]} de ecuación ${r + 1}`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }
  }

  steps.push({
    label: 'Forma triangular superior',
    description: matrixToString(aug),
    matrix: cloneMatrix(aug),
    separatorCol: n,
  })

  // Back substitution
  const solution = Array(n).fill(0)
  const backSteps: string[] = []

  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n]
    const terms: string[] = [`${fmtNum(aug[i][n])}`]
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * solution[j]
      terms.push(`- (${fmtNum(aug[i][j])})(${fmtNum(solution[j])})`)
    }
    solution[i] = sum / aug[i][i]
    if (Math.abs(solution[i]) < 1e-12) solution[i] = 0
    backSteps.push(`${variables[i]} = (${terms.join(' ')}) / ${fmtNum(aug[i][i])} = ${fmtNum(solution[i])}`)
  }

  steps.push({
    label: 'Sustitución hacia atrás',
    description: backSteps.join('\n'),
  })

  steps.push({
    label: 'Solución',
    description: variables.map((v, i) => `${v} = ${fmtNum(solution[i])}`).join('\n'),
  })

  // Verification
  const verification = verifySystem(coeff, constants, solution, variables)

  return { solution, steps, variables, verification }
}

function gaussJordan(coeff: Matrix, constants: number[], variables: string[]): SystemResult {
  const n = coeff.length
  const aug = buildAugmented(coeff, constants)
  const steps: Step[] = []

  steps.push({
    label: 'Matriz aumentada [A|b]',
    description: matrixToString(aug),
    matrix: cloneMatrix(aug),
    separatorCol: n,
  })

  for (let col = 0; col < n; col++) {
    let pivotRow = -1
    for (let r = col; r < n; r++) {
      if (Math.abs(aug[r][col]) > 1e-12) { pivotRow = r; break }
    }
    if (pivotRow === -1) throw new Error('El sistema no tiene solución única')

    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]]
      steps.push({
        label: `Intercambio F${col + 1} ↔ F${pivotRow + 1}`,
        description: `Colocar pivote en posición (${col + 1},${col + 1})`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }

    // Normalize
    const pivot = aug[col][col]
    if (Math.abs(pivot - 1) > 1e-12) {
      for (let c = col; c <= n; c++) {
        aug[col][c] /= pivot
        if (Math.abs(aug[col][c]) < 1e-12) aug[col][c] = 0
      }
      steps.push({
        label: `F${col + 1} → F${col + 1} / ${fmtNum(pivot)}`,
        description: `Normalizar fila ${col + 1}`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }

    // Eliminate all other rows
    for (let r = 0; r < n; r++) {
      if (r === col || Math.abs(aug[r][col]) < 1e-12) continue
      const factor = aug[r][col]
      for (let c = col; c <= n; c++) {
        aug[r][c] -= factor * aug[col][c]
        if (Math.abs(aug[r][c]) < 1e-12) aug[r][c] = 0
      }
      steps.push({
        label: `F${r + 1} → F${r + 1} - (${fmtNum(factor)})F${col + 1}`,
        description: `Eliminar ${variables[col]} de ecuación ${r + 1}`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }
  }

  const solution = aug.map(row => row[n])

  steps.push({
    label: 'Forma escalonada reducida [I|x]',
    description: matrixToString(aug),
    matrix: cloneMatrix(aug),
    separatorCol: n,
  })

  steps.push({
    label: 'Solución',
    description: variables.map((v, i) => `${v} = ${fmtNum(solution[i])}`).join('\n'),
  })

  const verification = verifySystem(coeff, constants, solution, variables)

  return { solution, steps, variables, verification }
}

function montante(coeff: Matrix, constants: number[], variables: string[]): SystemResult {
  const n = coeff.length
  const aug = buildAugmented(coeff, constants)
  const steps: Step[] = []
  let prevPivot = 1

  steps.push({
    label: 'Matriz aumentada [A|b]',
    description: matrixToString(aug),
    matrix: cloneMatrix(aug),
    separatorCol: n,
  })

  steps.push({
    label: 'Método de Montante (Bareiss)',
    description: 'Se aplica eliminación sin fracciones. Pivote anterior inicial = 1',
  })

  for (let k = 0; k < n; k++) {
    let pivotRow = -1
    for (let r = k; r < n; r++) {
      if (Math.abs(aug[r][k]) > 1e-12) { pivotRow = r; break }
    }
    if (pivotRow === -1) throw new Error('El sistema no tiene solución única')

    if (pivotRow !== k) {
      [aug[k], aug[pivotRow]] = [aug[pivotRow], aug[k]]
      steps.push({
        label: `Intercambio F${k + 1} ↔ F${pivotRow + 1}`,
        description: `Colocar pivote en posición (${k + 1},${k + 1})`,
        matrix: cloneMatrix(aug),
        separatorCol: n,
      })
    }

    const currentPivot = aug[k][k]

    for (let i = 0; i < n; i++) {
      if (i === k) continue
      for (let j = n; j >= 0; j--) {
        if (j === k) continue
        aug[i][j] = (currentPivot * aug[i][j] - aug[i][k] * aug[k][j]) / prevPivot
        if (Math.abs(aug[i][j]) < 1e-9) aug[i][j] = 0
      }
      aug[i][k] = 0
    }

    steps.push({
      label: `Pivoteo k=${k + 1}, pivote=${fmtNum(currentPivot)}, piv.ant.=${fmtNum(prevPivot)}`,
      description: `Para cada i≠${k + 1}, j≠${k + 1}: a'_ij = (${fmtNum(currentPivot)} × a_ij - a_i${k + 1} × a_${k + 1}j) / ${fmtNum(prevPivot)}`,
      matrix: cloneMatrix(aug),
      separatorCol: n,
    })

    prevPivot = currentPivot
  }

  // Extract solution
  const solution = aug.map((row, i) => {
    const val = row[n] / row[i]
    return Math.abs(val) < 1e-12 ? 0 : val
  })

  steps.push({
    label: 'Solución',
    description: variables.map((v, i) => `${v} = ${fmtNum(aug[i][n])} / ${fmtNum(aug[i][i])} = ${fmtNum(solution[i])}`).join('\n'),
  })

  const verification = verifySystem(coeff, constants, solution, variables)

  return { solution, steps, variables, verification }
}

function cramer(coeff: Matrix, constants: number[], variables: string[]): SystemResult {
  const n = coeff.length
  const A = cloneMatrix(coeff)
  const detA = determinantValue(A)

  if (Math.abs(detA) < 1e-10) {
    throw new Error('El sistema no tiene solución única (det(A) = 0, la matriz es singular)')
  }

  const steps: Step[] = []
  const cramerTabs: CramerTab[] = []

  // Tab 0: det(A)
  const detAResult = determinantByExpansion(A, 'row', 0)
  cramerTabs.push({
    label: 'det(A)',
    matrix: cloneMatrix(A),
    determinant: detA,
    steps: detAResult.steps,
  })

  steps.push({
    label: 'Matriz de coeficientes A',
    description: matrixToString(A),
    matrix: cloneMatrix(A),
  })
  steps.push({
    label: 'det(A)',
    description: `det(A) = ${fmtNum(detA)}`,
  })

  const solution: number[] = []

  for (let i = 0; i < n; i++) {
    // Build A_i: replace column i with constants
    const Ai = cloneMatrix(A)
    for (let r = 0; r < n; r++) {
      Ai[r][i] = constants[r]
    }

    const detAi = determinantValue(Ai)
    const xi = detAi / detA

    // Steps for this A_i determinant
    const detAiResult = determinantByExpansion(Ai, 'row', 0)

    const subscript = sub(i + 1)
    cramerTabs.push({
      label: `A${subscript}`,
      matrix: cloneMatrix(Ai),
      determinant: detAi,
      variable: variables[i],
      value: xi,
      steps: detAiResult.steps,
    })

    steps.push({
      label: `Matriz A${subscript}`,
      description: `Reemplazar columna ${i + 1} de A con el vector de constantes b:\n${matrixToString(Ai)}`,
      matrix: cloneMatrix(Ai),
    })
    steps.push({
      label: `det(A${subscript})`,
      description: `det(A${subscript}) = ${fmtNum(detAi)}`,
    })
    steps.push({
      label: `${variables[i]}`,
      description: `${variables[i]} = det(A${subscript}) / det(A) = ${fmtNum(detAi)} / ${fmtNum(detA)} = ${fmtNum(xi)}`,
    })

    solution.push(xi)
  }

  // Final summary step
  steps.push({
    label: 'Solución',
    description: variables.map((v, i) => `${v} = ${fmtNum(solution[i])}`).join('\n'),
  })

  const verification = verifySystem(coeff, constants, solution, variables)

  return { solution, steps, variables, verification, cramerTabs }
}

function verifySystem(coeff: Matrix, constants: number[], solution: number[], _variables: string[]): string[] {
  const n = coeff.length
  const lines: string[] = []

  for (let i = 0; i < n; i++) {
    let sum = 0
    const terms: string[] = []
    for (let j = 0; j < n; j++) {
      sum += coeff[i][j] * solution[j]
      terms.push(`(${fmtNum(coeff[i][j])})(${fmtNum(solution[j])})`)
    }
    const cleanSum = Math.abs(sum) < 1e-9 ? 0 : sum
    const match = Math.abs(cleanSum - constants[i]) < 1e-6
    lines.push(`${terms.join(' + ')} = ${fmtNum(cleanSum)} ${match ? '✓' : '✗'} (esperado: ${fmtNum(constants[i])})`)
  }

  return lines
}

// ─── Equation Parser ────────────────────────────────────────────────────

export function parseEquationSystem(text: string): { coefficients: Matrix; constants: number[]; variables: string[] } {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) throw new Error('No se encontraron ecuaciones')

  // Find all variables
  const varSet = new Set<string>()
  const varRegex = /([a-zA-Z]\w*)/g

  for (const line of lines) {
    const [left] = line.split('=')
    if (!left) throw new Error(`Ecuación inválida: ${line}`)
    let match
    while ((match = varRegex.exec(left)) !== null) {
      varSet.add(match[1])
    }
  }

  const variables = Array.from(varSet).sort((a, b) => {
    // Sort x1, x2, x3... or x, y, z...
    const numA = a.match(/\d+$/)
    const numB = b.match(/\d+$/)
    if (numA && numB) return parseInt(numA[0]) - parseInt(numB[0])
    return a.localeCompare(b)
  })

  const n = lines.length
  if (variables.length !== n) {
    throw new Error(`Se encontraron ${variables.length} variables y ${n} ecuaciones. Debe haber la misma cantidad.`)
  }

  const coefficients: Matrix = []
  const constants: number[] = []

  for (const line of lines) {
    const [left, right] = line.split('=').map(s => s.trim())
    if (right === undefined) throw new Error(`Falta '=' en: ${line}`)

    constants.push(parseFloat(right))

    // Parse coefficients from left side
    const row = Array(variables.length).fill(0)

    // Normalize: add + before minus to split terms
    const normalized = left.replace(/\s/g, '').replace(/-/g, '+-')
    const terms = normalized.split('+').filter(t => t)

    for (const term of terms) {
      // Find which variable this term contains
      let found = false
      for (let vi = 0; vi < variables.length; vi++) {
        const v = variables[vi]
        if (term.includes(v)) {
          const coefStr = term.replace(v, '')
          let coef: number
          if (coefStr === '' || coefStr === '+') coef = 1
          else if (coefStr === '-') coef = -1
          else coef = parseFloat(coefStr)
          row[vi] = coef
          found = true
          break
        }
      }
      if (!found && term !== '') {
        throw new Error(`Término no reconocido: "${term}" en ecuación "${line}"`)
      }
    }

    coefficients.push(row)
  }

  return { coefficients, constants, variables }
}
