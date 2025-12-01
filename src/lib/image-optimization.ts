/**
 * Image Optimization Utilities
 * Provides compression and optimization for images before upload
 */

import sharp from 'sharp'

export interface ImageOptimizationOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'webp' | 'png'
  maxSizeBytes?: number
}

const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 85,
  format: 'jpeg',
  maxSizeBytes: 2 * 1024 * 1024 // 2MB
}

/**
 * Optimize image buffer with compression
 */
export async function optimizeImage(
  buffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  let image = sharp(buffer)
  
  // Get image metadata
  const metadata = await image.metadata()
  
  // Resize if needed
  if (metadata.width && metadata.height) {
    if (metadata.width > opts.maxWidth || metadata.height > opts.maxHeight) {
      image = image.resize(opts.maxWidth, opts.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
    }
  }
  
  // Convert and compress based on format
  let optimized: Buffer
  switch (opts.format) {
    case 'webp':
      optimized = await image
        .webp({ quality: opts.quality, effort: 4 })
        .toBuffer()
      break
    case 'png':
      optimized = await image
        .png({ quality: opts.quality, compressionLevel: 9 })
        .toBuffer()
      break
    case 'jpeg':
    default:
      optimized = await image
        .jpeg({ 
          quality: opts.quality,
          mozjpeg: true, // Better compression
          progressive: true // Progressive JPEG for better perceived performance
        })
        .toBuffer()
      break
  }
  
  // If still too large, reduce quality iteratively
  let quality = opts.quality
  while (optimized.length > opts.maxSizeBytes && quality > 50) {
    quality -= 10
    image = sharp(buffer)
    if (metadata.width && metadata.height) {
      if (metadata.width > opts.maxWidth || metadata.height > opts.maxHeight) {
        image = image.resize(opts.maxWidth, opts.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
      }
    }
    
    switch (opts.format) {
      case 'webp':
        optimized = await image.webp({ quality, effort: 4 }).toBuffer()
        break
      case 'png':
        optimized = await image.png({ quality, compressionLevel: 9 }).toBuffer()
        break
      case 'jpeg':
      default:
        optimized = await image.jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer()
        break
    }
  }
  
  return optimized
}

/**
 * Optimize image from File object
 */
export async function optimizeImageFile(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return optimizeImage(buffer, options)
}

/**
 * Get optimized image dimensions and size info
 */
export async function getImageInfo(buffer: Buffer): Promise<{
  width: number
  height: number
  size: number
  format: string
}> {
  const metadata = await sharp(buffer).metadata()
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    size: buffer.length,
    format: metadata.format || 'unknown'
  }
}

