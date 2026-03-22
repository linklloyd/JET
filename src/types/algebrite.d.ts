declare module 'algebrite' {
  const Algebrite: {
    run(expr: string): string
    integral(expr: string, variable?: string): string
    simplify(expr: string): string
    derivative(expr: string, variable?: string): string
    factor(expr: string): string
  }
  export default Algebrite
}
