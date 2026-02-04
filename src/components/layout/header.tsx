'use client'

import { OrgSwitcher } from '@/components/org-switcher'
import { UserSwitcher } from '@/components/user-switcher'

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <OrgSwitcher />
      </div>
      <div className="flex items-center gap-4">
        <UserSwitcher />
      </div>
    </header>
  )
}
