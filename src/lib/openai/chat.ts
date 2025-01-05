import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { scrapeNotionPages } from '../scraper/notion'
import { createEmbeddings, findRelevantChunks, type DocumentChunk, type ScrapedDocument as EmbeddingsDocument } from '../embeddings/handler'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

let documentChunks: DocumentChunk[] | null = null
let initializationPromise: Promise<DocumentChunk[]> | null = null

async function initializeDocuments() {
  if (documentChunks) return documentChunks
  if (initializationPromise) return initializationPromise
  
  initializationPromise = (async () => {
    const documents = await scrapeNotionPages() as unknown as EmbeddingsDocument[]
    console.log('Scraped docs:', documents)
    
    documentChunks = await createEmbeddings(documents)
    console.log('Created chunks:', documentChunks)
    return documentChunks
  })()
  
  return initializationPromise
}

// Start initialization immediately
initializeDocuments().catch(console.error)

export async function getChatResponse(question: string, chatHistory: string[] = []) {
  // Wait for initialization to complete
  documentChunks = await initializeDocuments()

  const relevantChunks = await findRelevantChunks(question, documentChunks)
  const context = relevantChunks.map(chunk => chunk.content).join('\n\n')

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a helpful Crustdata API support assistant. Answer questions using ONLY the following documentation context. Never refer users to external documentation or Notion pages. If you're not completely sure about something, say so directly:

${context}

Response Format:
1. Use markdown formatting for better readability
2. Use \`inline code\` for API endpoints, parameters, and values
3. Use code blocks with language tags for examples:
   \`\`\`http
   GET /api/endpoint
   \`\`\`
   \`\`\`json
   {
     "key": "value"
   }
   \`\`\`
4. Use bullet points and numbered lists for steps
5. Use bold and italics for emphasis
6. Keep responses concise and well-structured

Instructions:
1. Use ONLY the provided context to answer questions
2. NEVER refer users to external documentation
3. If information is missing, acknowledge the limitations
4. Be direct and specific in responses`
    },
    ...chatHistory.map((msg, i): ChatCompletionMessageParam => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: msg
    })),
    { role: 'user', content: question }
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
  })

  return response.choices[0].message.content
} 