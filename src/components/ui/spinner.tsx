import { cn } from "@/lib/utils"

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin", className)}
      aria-hidden="true"
    />
  )
}
