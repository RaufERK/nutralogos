declare module 'word-extractor' {
  class Extractor {
    extract(input: unknown): Promise<{
      getBody(): string
      getFootnotes(): string
      getEndnotes(): string
    }>
  }
  export default Extractor
}


