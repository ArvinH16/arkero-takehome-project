'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useDepartmentList } from '@/lib/features/hooks'

interface DepartmentFilterProps {
  selectedDepartment: string | null
  onSelectDepartment: (department: string | null) => void
}

export function DepartmentFilter({ selectedDepartment, onSelectDepartment }: DepartmentFilterProps) {
  const departments = useDepartmentList()

  if (departments.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* All departments option */}
      <button
        onClick={() => onSelectDepartment(null)}
        className="focus:outline-none"
      >
        <Badge
          variant={selectedDepartment === null ? 'default' : 'outline'}
          className={cn(
            'cursor-pointer transition-colors',
            selectedDepartment === null
              ? ''
              : 'hover:bg-muted'
          )}
        >
          All Departments
        </Badge>
      </button>

      {/* Department chips */}
      {departments.map((dept) => (
        <button
          key={dept}
          onClick={() => onSelectDepartment(dept)}
          className="focus:outline-none"
        >
          <Badge
            variant={selectedDepartment === dept ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer transition-colors',
              selectedDepartment === dept
                ? ''
                : 'hover:bg-muted'
            )}
          >
            {dept}
          </Badge>
        </button>
      ))}
    </div>
  )
}

/**
 * Simple department selector for forms
 */
interface DepartmentSelectProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
}

export function DepartmentSelect({ value, onChange, required, className }: DepartmentSelectProps) {
  const departments = useDepartmentList()

  if (departments.length === 0) {
    return null
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      <option value="">Select department...</option>
      {departments.map((dept) => (
        <option key={dept} value={dept}>
          {dept}
        </option>
      ))}
    </select>
  )
}
