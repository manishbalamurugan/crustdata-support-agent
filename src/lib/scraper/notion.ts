import { chromium, type Page } from 'playwright'
import path from 'path'
import fs from 'fs'

interface NotionPage {
  url: string
  title: string
}

interface NotionBlock {
  type: 'text' | 'code' | 'heading' | 'toggle' | 'list'
  content: string
  children?: NotionBlock[]
  chunks?: string[]
  metadata?: {
    level?: number
    isExpanded?: boolean
    language?: string
  }
}

interface ScrapedDocument {
  title: string
  url: string
  content: NotionBlock[]
}

const NOTION_PAGES: NotionPage[] = [
  {
    url: 'https://crustdata.notion.site/Crustdata-Discovery-And-Enrichment-API-c66d5236e8ea40df8af114f6d447ab48',
    title: 'Discovery API'
  },
  {
    url: 'https://crustdata.notion.site/Crustdata-Data-Dictionary-c265aa415fda41cb871090cbf7275922',
    title: 'Data Dictionary'
  },
  {
    url: 'https://crustdata.notion.site/Crustdata-Dataset-API-Detailed-Examples-b83bd0f1ec09452bb0c2cac811bba88c',
    title: 'Dataset API Examples'
  }
]

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 3000
): Promise<T> {
  let lastError: Error = new Error('Operation failed')
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const delay = initialDelay * Math.pow(2, i) // Exponential backoff
      console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`, lastError.message)
      await wait(delay)
    }
  }
  
  throw lastError
}

async function expandAllBlocks(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const toggles = document.querySelectorAll('.notion-toggle-block');
    for (const toggle of toggles) {
      const button = toggle.querySelector('button, [role="button"]');
      if (button) {
        (button as HTMLElement).click();
        await sleep(100);
      }
    }
  });
  
  // Wait for content to stabilize
  await page.waitForTimeout(3000);
}

function chunkText(text: string, maxLength: number = 1000): string[] {
  const chunks: string[] = []
  const sentences = text.split(/[.!?]+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = sentence
    } else {
      currentChunk += sentence + '.'
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

async function extractNotionContent(page: Page): Promise<NotionBlock[]> {
  await page.waitForSelector('[class*="notion-page-content"]')
  
  // Extract all blocks
  const blocks = await page.evaluate(() => {
    const blocks: NotionBlock[] = []
    
    // Helper function to extract text content safely
    const getTextContent = (el: Element | null): string => 
      el?.textContent?.trim() || ''
    
    // Find all toggle blocks
    const toggles = document.querySelectorAll('[class*="notion-toggle-block"]')
    
    toggles.forEach(toggle => {
      // Get toggle header
      const header = toggle.querySelector('[data-content-editable-leaf="true"]')
      const headerText = getTextContent(header)
      
      // Get toggle content
      const content = toggle.querySelector('[id^=":r"]')
      const children: NotionBlock[] = []
      
      if (content) {
        // Handle text blocks
        content.querySelectorAll('[class*="notion-text-block"]').forEach(text => {
          children.push({
            type: 'text',
            content: getTextContent(text)
          })
        })
        
        // Handle code blocks
        content.querySelectorAll('[class*="notion-code-block"]').forEach(code => {
          const language = code.querySelector('[role="button"]')
          children.push({
            type: 'code',
            content: getTextContent(code),
            metadata: {
              language: getTextContent(language) || 'text'
            }
          })
        })
        
        // Handle lists
        content.querySelectorAll('[class*="notion-bulleted_list-block"]').forEach(list => {
          children.push({
            type: 'list',
            content: getTextContent(list)
          })
        })
        
        // Handle headings
        content.querySelectorAll('[class*="notion-header-block"]').forEach(heading => {
          const level = parseInt(heading.getAttribute('data-block-level') || '1')
          children.push({
            type: 'heading',
            content: getTextContent(heading),
            metadata: {
              level
            }
          })
        })
      }
      
      blocks.push({
        type: 'toggle',
        content: headerText,
        children,
        metadata: {
          isExpanded: toggle.getAttribute('aria-expanded') === 'true'
        }
      })
    })
    
    return blocks
  })

  return blocks
}

async function generateScreenshot(page: Page, title: string): Promise<string> {
  const screenshotPath = path.join(process.cwd(), 'docs', `${title.replace(/\s+/g, '-').toLowerCase()}.png`)
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  })
  return screenshotPath
}

async function extractHierarchicalContent(page: Page): Promise<NotionBlock[]> {
  const blocks = await extractNotionContent(page)
  
  // Process blocks to maintain hierarchy
  const processedBlocks = blocks.map(block => {
    if (block.type === 'toggle' && block.children) {
      // Recursively process nested blocks
      block.children = block.children.map(child => {
        if (child.type === 'toggle') {
          return {
            ...child,
            children: processNestedBlocks(child.children || [])
          }
        }
        return child
      })
    }
    return block
  })
  
  return processedBlocks
}

function processNestedBlocks(blocks: NotionBlock[]): NotionBlock[] {
  return blocks.map(block => {
    if (block.type === 'toggle' && block.children) {
      return {
        ...block,
        children: processNestedBlocks(block.children)
      }
    }
    return block
  })
}

export async function scrapeNotionPage(url: string): Promise<NotionBlock[]> {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox']
  })
  
  try {
    const page = await browser.newPage()
    
    // Changed networkidle0 to networkidle to match Playwright's API
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 })
    
    // Extract content with hierarchy
    const content = await extractHierarchicalContent(page)
    
    return content
  } catch (error) {
    console.error('Error scraping Notion page:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export async function scrapeNotionPages(): Promise<ScrapedDocument[]> {
  const documents: ScrapedDocument[] = []
  
  for (const page of NOTION_PAGES) {
    const content = await scrapeNotionPage(page.url)
    // Flatten toggle blocks into text blocks
    const flattenedContent = content.flatMap(block => {
      if (block.type === 'toggle') {
        return [
          { type: 'text' as const, content: block.content },
          ...(block.children || [])
        ]
      }
      return block
    })
    
    documents.push({
      title: page.title,
      url: page.url,
      content: flattenedContent
    })
  }
  
  return documents
}
