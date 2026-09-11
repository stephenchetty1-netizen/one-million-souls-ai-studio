import OpenAI from 'openai'
import { z } from 'zod'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'

const Schema = z.object({ prompts: z.array(z.string()).length(3), concept: z.string().min(1) })

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'OPENAI_API_KEY is not configured on the server.' }, { status: 500 })
    const { prompts, concept } = Schema.parse(await req.json())
    const images = []
    for (const prompt of prompts) {
      const response = await client.responses.create({
        model: IMAGE_MODEL,
        input: `Create a vertical 9:16 Christian social-media visual for this campaign direction. Concept: ${concept}. Visual prompt: ${prompt}. Avoid fake Scripture text inside the image; prioritize symbolic, cinematic, respectful Christian imagery.`,
        tools: [{ type: 'image_generation', size: '1024x1536', quality: 'high' }],
      })
      const image = response.output.find((item: any) => item.type === 'image_generation_call') as any
      if (image?.result) images.push({ prompt, image: image.result })
    }
    return Response.json({ images })
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) return Response.json({ error: 'Invalid image request.' }, { status: 400 })
    return Response.json({ error: error instanceof Error ? error.message : 'Image generation failed.' }, { status: 500 })
  }
}
