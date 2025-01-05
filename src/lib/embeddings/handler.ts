import OpenAI from 'openai'

export interface ScrapedDocument {
  title: string
  url: string
  content: Block[]
}

interface Block {
  type: 'heading' | 'code' | 'list' | 'text'
  content: string
  chunks?: string[]
  metadata?: {
    language?: string
  }
}

export interface DocumentChunk {
  content: string
  embedding: number[]
  metadata: {
    title: string
    url: string
    type: string
  }
}

function formatBlockContent(doc: ScrapedDocument): string[] {
  return doc.content.map((block: Block) => {
    switch (block.type) {
      case 'heading':
        return `# ${block.content}`
      case 'code':
        return `\`\`\`${block.metadata?.language || ''}\n${block.content}\n\`\`\``
      case 'list':
        return block.content.split('\n').map((item: string) => `• ${item}`).join('\n')
      default:
        return block.content
    }
  })
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function chunkContent(content: string, maxLength: number = 1000): string[] {
  const chunks: string[] = []
  const sentences = content.split(/[.!?]+/)
  
  let currentChunk = ''
  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    
    if (currentChunk.length + trimmed.length > maxLength) {
      if (currentChunk) chunks.push(currentChunk.trim())
      currentChunk = trimmed
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmed
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim())
  return chunks
}

export async function createEmbeddings(documents: ScrapedDocument[]): Promise<DocumentChunk[]> {
  const embeddings: any[] = []
  
  for (const doc of documents) {
    for (const block of doc.content) {
      try {
        if (block.type === 'code') {
          // Handle code blocks as before
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: block.content.slice(0, 8000) // Safeguard against long code blocks
          })
          embeddings.push({
            embedding: embeddingResponse.data[0].embedding,
            metadata: {
              title: doc.title,
              url: doc.url,
              type: block.type,
              ...block.metadata
            }
          })
        } else if (block.chunks) {
          for (const chunk of block.chunks) {
            const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-ada-002',
              input: chunk
            })
            embeddings.push({
              embedding: embeddingResponse.data[0].embedding,
              metadata: {
                title: doc.title,
                url: doc.url,
                type: block.type,
                chunk: chunk,
                ...block.metadata
              }
            })
          }
        } else {
          // Handle other blocks normally
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: block.content
          })
          embeddings.push({
            embedding: embeddingResponse.data[0].embedding,
            metadata: {
              title: doc.title,
              url: doc.url,
              type: block.type,
              ...block.metadata
            }
          })
        }
      } catch (error) {
        console.error('Error creating embedding:', error)
        // Continue with other blocks
      }
    }
  }

  return embeddings
}

export async function findRelevantChunks(question: string, chunks: DocumentChunk[], topK: number = 5): Promise<DocumentChunk[]> {
  // Get embedding for the question
  const questionEmbedding = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: question,
  })

  // Calculate cosine similarity with all chunks
  const similarities = chunks.map(chunk => ({
    chunk,
    similarity: cosineSimilarity(questionEmbedding.data[0].embedding, chunk.embedding)
  }))

  // Sort by similarity and get top K chunks
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map(item => item.chunk)
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
} 