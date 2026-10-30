/*
 * Player photos, team logos and team photos (change 004).
 * Photos live in a private Supabase Storage bucket: only league members can see them, through
 * short-lived links. They are shrunk on the phone before upload and never overwritten: each upload
 * gets a new file name, and the player or team row points at the newest one.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export const PHOTO_BUCKET = 'photos'
/** Longest side after shrinking, in pixels. Big enough for a full-width hero on a phone. */
export const PHOTO_MAX_SIDE = 1200
/** Must match file_size_limit in supabase/changes/004_photos.sql (2 MB). */
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024
const LINK_SECONDS = 60 * 60

export type PhotoKind = 'player' | 'logo' | 'team-photo'

/** Where a new upload goes. The database only accepts these exact shapes. */
export function photoPath(kind: PhotoKind, ownerId: string, ext: 'webp' | 'jpg', fileId: string = crypto.randomUUID()): string {
  if (kind === 'player') return `players/${ownerId}/${fileId}.${ext}`
  return `teams/${ownerId}/${kind === 'logo' ? 'logo' : 'photo'}-${fileId}.${ext}`
}

/** Fits width × height inside a square of `max`, keeping the shape. Never enlarges. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Shrinks a picked image on the phone. WebP where the browser can make it, JPEG otherwise
 * (older Safari). Logos keep transparency only as WebP; JPEG gets the app background behind it.
 */
export async function shrinkImage(file: File, max = PHOTO_MAX_SIDE): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  if (!file.type.startsWith('image/')) throw new Error('Pick a photo (JPEG, PNG, HEIC or WebP).')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that photo. Try a JPEG or PNG.")
  })
  const size = fitWithin(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Couldn't read that photo.")
  ctx.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()

  const encode = (type: string, quality: number) => new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality))
  const webp = await encode('image/webp', 0.85)
  if (webp && webp.type === 'image/webp' && webp.size <= PHOTO_MAX_BYTES) return { blob: webp, ext: 'webp' }

  // JPEG has no transparency: paint the app background underneath first.
  const flat = document.createElement('canvas')
  flat.width = size.width
  flat.height = size.height
  const fctx = flat.getContext('2d')!
  fctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || 'black'
  fctx.fillRect(0, 0, size.width, size.height)
  fctx.drawImage(canvas, 0, 0)
  for (const q of [0.85, 0.7, 0.55]) {
    const jpg = await new Promise<Blob | null>((done) => flat.toBlob(done, 'image/jpeg', q))
    if (jpg && jpg.size <= PHOTO_MAX_BYTES) return { blob: jpg, ext: 'jpg' }
  }
  throw new Error('That photo is too big even after shrinking.')
}

/** Shrinks and uploads a photo, returning its storage path. */
export async function uploadPhoto(kind: PhotoKind, ownerId: string, file: File): Promise<string> {
  const { blob, ext } = await shrinkImage(file)
  const path = photoPath(kind, ownerId, ext)
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg',
    upsert: false,
    cacheControl: '31536000',
  })
  if (error) {
    console.error(error)
    throw new Error("Couldn't upload the photo. Check your signal and try again.")
  }
  return path
}

/** A short-lived link to a private photo, or undefined while loading / when there is none. */
export function usePhotoUrl(path: string | null | undefined): string | undefined {
  const q = useQuery({
    queryKey: ['photo-url', path],
    enabled: !!path,
    staleTime: (LINK_SECONDS - 10 * 60) * 1000,
    gcTime: LINK_SECONDS * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path!, LINK_SECONDS)
      if (error) throw new Error('Request failed')
      return data.signedUrl
    },
  })
  return q.data
}
