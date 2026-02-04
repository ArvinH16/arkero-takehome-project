'use client'

import { LogOut, User } from 'lucide-react'
import { useAuth } from '@/lib/context/auth-context'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

export function Header() {
  const { profile, organization, signOut, isLoading } = useAuth()

  if (isLoading) {
    return (
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      </header>
    )
  }

  const initials = profile?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  const roleColor = {
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-blue-100 text-blue-800',
    department_head: 'bg-green-100 text-green-800',
    staff: 'bg-gray-100 text-gray-800',
  }[profile?.role || 'staff']

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        {organization && (
          <div className="flex items-center gap-2">
            <span className="font-semibold">{organization.name}</span>
            {profile?.department && (
              <Badge variant="outline" className="font-normal">
                {profile.department}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-2">
                <p className="text-sm font-medium leading-none">{profile?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {profile?.email}
                </p>
                {profile?.role && (
                  <Badge className={`w-fit ${roleColor}`} variant="secondary">
                    {profile.role.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-muted-foreground">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
