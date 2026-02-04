import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? parseISO(date) : date
  if (!isValid(d)) return "—"
  return format(d, "MMM d, yyyy")
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? parseISO(date) : date
  if (!isValid(d)) return "—"
  return format(d, "MMM d, yyyy h:mm a")
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? parseISO(date) : date
  if (!isValid(d)) return "—"
  return formatDistanceToNow(d, { addSuffix: true })
}
