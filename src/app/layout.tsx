import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { BackgroundImage } from '@/components/BackgroundImage'

export const metadata: Metadata = {
  title: 'RAG Chat - AI Assistant',
  description: 'Intelligent chat bot with Retrieval-Augmented Generation',
  icons: {
    icon: [
      { url: '/favicon.ico?v=2' },
      { url: '/favicon.ico', rel: 'shortcut icon' },
    ],
    shortcut: ['/favicon.ico?v=2'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body className='antialiased'>
        <BackgroundImage />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
