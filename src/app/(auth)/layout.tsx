import { Zap } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/50 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Touchline</span>
        </div>
        {children}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Game Day Operations Platform
        </p>
      </div>
    </div>
  )
}
