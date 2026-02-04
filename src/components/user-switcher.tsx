'use client'

import { User as UserIcon, ChevronDown, Check } from 'lucide-react'
import { useOrg } from '@/lib/context/org-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  department_head: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  staff: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  department_head: 'Dept Head',
  staff: 'Staff',
}

export function UserSwitcher() {
  const { user, users, switchUser, isLoading } = useOrg()

  if (isLoading) {
    return (
      <Button variant="ghost" disabled className="w-[180px] justify-between">
        <span className="flex items-center gap-2">
          <UserIcon className="h-4 w-4" />
          Loading...
        </span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-[180px] justify-between">
          <span className="flex items-center gap-2 truncate">
            <UserIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{user?.name || 'Select user'}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[250px]">
        <DropdownMenuLabel>Switch User</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.map((u) => (
          <DropdownMenuItem
            key={u.id}
            onClick={() => switchUser(u.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="truncate font-medium">{u.name}</span>
              <span className="text-xs text-muted-foreground truncate">
                {u.department || u.email}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className={roleColors[u.role]}>
                {roleLabels[u.role]}
              </Badge>
              {u.id === user?.id && <Check className="h-4 w-4" />}
            </div>
          </DropdownMenuItem>
        ))}
        {users.length === 0 && (
          <DropdownMenuItem disabled>
            No users in this organization
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
