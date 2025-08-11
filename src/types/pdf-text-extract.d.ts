declare module 'pdf-text-extract' {
  const extract: (
    path: string,
    options: { splitPages: boolean },
    cb: (err: unknown, text: string | string[]) => void
  ) => void
  export default extract
}


