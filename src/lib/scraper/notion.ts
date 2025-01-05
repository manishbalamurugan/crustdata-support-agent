import { chromium, type Page } from 'playwright'

interface NotionPage {
  url: string
  title: string
}

interface NotionBlock {
  type: 'text' | 'code' | 'heading' | 'list'
  content: string
  metadata?: {
    language?: string
    level?: number
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

async function extractNotionContent(page: Page): Promise<NotionBlock[]> {
  await page.waitForSelector('.notion-page-content')
  
  return await page.evaluate(() => {
    const blocks: NotionBlock[] = []
    const elements = document.querySelectorAll('.notion-page-content > div')

    elements.forEach(element => {
      // Extract text blocks
      if (element.classList.contains('notion-text-block')) {
        const text = element.textContent?.trim()
        if (text) {
          blocks.push({ type: 'text', content: text })
        }
      }
      
      // Extract code blocks
      else if (element.classList.contains('notion-code-block')) {
        const code = element.querySelector('code')?.textContent?.trim()
        const language = element.getAttribute('data-language') || 'plaintext'
        if (code) {
          blocks.push({
            type: 'code',
            content: code,
            metadata: { language }
          })
        }
      }
      
      // Extract headings
      else if (element.classList.contains('notion-header-block')) {
        const text = element.textContent?.trim()
        const level = parseInt(element.tagName.charAt(1)) || 1
        if (text) {
          blocks.push({
            type: 'heading',
            content: text,
            metadata: { level }
          })
        }
      }
      
      // Extract lists
      else if (element.classList.contains('notion-bulleted-list') || 
               element.classList.contains('notion-numbered-list')) {
        const items = Array.from(element.querySelectorAll('li'))
          .map(li => li.textContent?.trim())
          .filter(Boolean)
        if (items.length) {
          blocks.push({
            type: 'list',
            content: items.join('\n')
          })
        }
      }
    })

    return blocks
  })
}

export async function scrapeNotionPages(): Promise<ScrapedDocument[]> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const documents: ScrapedDocument[] = []

  try {
    for (const pageInfo of NOTION_PAGES) {
      const page = await context.newPage()
      await page.goto(pageInfo.url, { waitUntil: 'networkidle' })
      
      const blocks = await extractNotionContent(page)
      
      documents.push({
        title: pageInfo.title,
        url: pageInfo.url,
        content: blocks
      })

      await page.close()
    }
  } finally {
    await browser.close()
  }

  return documents
} 