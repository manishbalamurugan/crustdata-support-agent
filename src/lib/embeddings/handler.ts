import OpenAI from 'openai'

export interface ScrapedDocument {
  title: string
  url: string
  content: Block[]
}

interface Block {
  type: 'heading' | 'code' | 'list' | 'text'
  content: string
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

export async function createEmbeddings(documents: ScrapedDocument[]): Promise<DocumentChunk[]> {
  const chunks: DocumentChunk[] = []

  for (const doc of documents) {
    const formattedContent = formatBlockContent(doc)
    
    // Create embeddings for each block
    for (const content of formattedContent) {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: content,
      })

      chunks.push({
        content,
        embedding: embeddingResponse.data[0].embedding,
        metadata: {
          title: doc.title,
          url: doc.url,
          type: content.startsWith('#') ? 'heading' : 
                content.startsWith('```') ? 'code' : 
                content.startsWith('•') ? 'list' : 'text'
        }
      })
    }
  }

  return chunks
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