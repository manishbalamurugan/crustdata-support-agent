import { NextResponse } from 'next/server'
import { getChatResponse } from '@/lib/openai/chat'

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json()
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const response = await getChatResponse(message, history)
    
    return NextResponse.json({ response })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to get response' },
      { status: 500 }
    )
  }
} 