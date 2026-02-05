import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { PermanentAIBar } from '@/components/rag/permanent-ai-bar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Header />
        <main className="p-6 pb-32">{children}</main>
      </div>
      <PermanentAIBar />
    </div>
  )
}
