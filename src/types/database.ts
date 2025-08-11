export interface FileRecord {
  id: string
  filename: string
  original_name: string
  file_hash: string
  file_size: number
  mime_type: string
  upload_date: string
  status: FileStatus
  chunks_count: number
  qdrant_points: string[] | null
  metadata: FileMetadata | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type FileStatus = 'processing' | 'completed' | 'error' | 'deleted'

export interface FileMetadata {
  title?: string
  author?: string
  pages?: number
  language?: string
  category?: string
  tags?: string[]
  description?: string
}

export interface UploadLog {
  id: number
  file_id: string
  action: LogAction
  status: LogStatus
  message: string | null
  details: Record<string, unknown> | null
  timestamp: string
}

export type LogAction = 'upload' | 'process' | 'error' | 'delete' | 'update'
export type LogStatus = 'success' | 'error' | 'warning'

export interface ChunkRecord {
  id: string
  file_id: string
  chunk_index: number
  content: string
  qdrant_point_id: string | null
  created_at: string
}
