import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Christian Content AI Studio', description: 'Jesus-centered content studio powered by the OpenAI Responses API' }
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html> }
