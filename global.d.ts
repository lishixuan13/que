declare let __DEV__: boolean

declare let Component: (...args: unknown[]) => any
declare let Page: (...args: unknown[]) => any
declare let App: (...args: unknown[]) => any
declare let getApp: () => any
// for tests
declare namespace jest {
  interface Matchers<R, T> {
    toHaveBeenWarned(): R
    toHaveBeenWarnedLast(): R
    toHaveBeenWarnedTimes(n: number): R
  }
}

declare module 'preprocess' {
  type p = (src, context?, typeOrOptions?) => any
  let preprocess: p
  export { preprocess }
}
