import { AuthGuard } from "@/components/auth-guard"

export default function BarangayLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["barangay"]}>
      {children}
    </AuthGuard>
  )
} 