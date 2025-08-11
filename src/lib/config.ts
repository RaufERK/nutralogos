const qdrantUrl = process.env.QDRANT_URL
const qdrantApiKey = process.env.QDRANT_API_KEY
const qdrantCollectionName = process.env.QDRANT_COLLECTION_NAME

if (!qdrantUrl) {
  throw new Error('QDRANT_URL is not set. Define it in your .env file.')
}

if (!qdrantApiKey) {
  throw new Error('QDRANT_API_KEY is not set. Define it in your .env file.')
}

if (!qdrantCollectionName) {
  throw new Error(
    'QDRANT_COLLECTION_NAME is not set. Define it in your .env file.'
  )
}

export const QDRANT_URL: string = qdrantUrl
export const QDRANT_API_KEY: string = qdrantApiKey
export const QDRANT_COLLECTION_NAME: string = qdrantCollectionName

export const QDRANT_VECTOR_SIZE = 1536
export const QDRANT_DISTANCE = 'Cosine' as const
