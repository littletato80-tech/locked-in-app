import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Locked In',
  description: 'Stay sober. Stay focused. Get paid.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
