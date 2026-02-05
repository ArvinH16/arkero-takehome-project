'use client'

import { useState } from 'react'
import { Trash2, ZoomIn, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { deleteTaskPhoto } from '@/lib/actions/photos'
import { formatRelativeTime } from '@/lib/utils'
import type { TaskPhoto } from '@/types/database'

interface PhotoGalleryProps {
  photos: TaskPhoto[]
  onPhotoDeleted?: () => void
  canDelete?: boolean
}

export function PhotoGallery({ photos, onPhotoDeleted, canDelete = true }: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this photo?')) {
      return
    }

    setDeletingId(photoId)

    try {
      const { error } = await deleteTaskPhoto(photoId)

      if (error) {
        toast.error('Delete failed', { description: error })
        return
      }

      toast.success('Photo deleted')
      onPhotoDeleted?.()
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Delete failed', { description: 'An unexpected error occurred.' })
    } finally {
      setDeletingId(null)
    }
  }

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No photos uploaded yet.
      </p>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative group aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
            onClick={() => setSelectedPhoto(photo)}
          >
            {/* Photo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.photo_url}
              alt="Task verification photo"
              className="object-cover w-full h-full transition-transform group-hover:scale-105"
            />

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

            {/* Zoom Icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-8 w-8 text-white" />
            </div>

            {/* Timestamp */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p className="text-white text-xs">
                {formatRelativeTime(photo.uploaded_at)}
              </p>
            </div>

            {/* Delete Button */}
            {canDelete && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleDelete(photo.id, e)}
                disabled={deletingId === photo.id}
              >
                {deletingId === photo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">
            Task verification photo
          </DialogTitle>
          {selectedPhoto && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.photo_url}
                alt="Task verification photo"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-white text-sm">
                  Uploaded {formatRelativeTime(selectedPhoto.uploaded_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-white/20"
                onClick={() => setSelectedPhoto(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
