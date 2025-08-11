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
