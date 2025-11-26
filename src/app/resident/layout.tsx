import { AuthGuard } from "@/components/auth-guard"

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* Your layout components */}
      {children}
    </AuthGuard>
  )
}