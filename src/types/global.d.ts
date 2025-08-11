declare global {
  var wsClients: Map<string, unknown> | undefined
  var sendToWSClient:
    | ((clientId: string, message: unknown) => boolean)
    | undefined
}

declare module 'pdfjs-dist/build/pdf.js' {
  // Minimal shape used in scripts
  const pdfjsLib: {
    getDocument: (opts: unknown) => { promise: Promise<unknown> }
  }
  export = pdfjsLib
}

export {}

declare module 'pdf-text-extract' {
  type ExtractCallback = (err: unknown, text: string | string[]) => void
  function extract(
    path: string,
    options: { splitPages: boolean },
    cb: ExtractCallback
  ): void
  export = extract
}
