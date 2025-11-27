import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { Database } from '@/types/supabase'

// Configure runtime for Node.js (required for file uploads)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Increase body size limit for file uploads (Next.js default is 1MB)
export const maxDuration = 60 // 60 seconds for large file uploads

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const BUCKET = 'admin-docs'
const ALLOWLIST = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg']

type AdminDocumentInsert = Database['public']['Tables']['admin_documents']['Insert']

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED', message: 'Not authenticated' }, { status: 401 })
    const uid = userRes.user.id
    // Admin-only access
    const { data: me } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!me || me.role !== 'admin') return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const folder_id = searchParams.get('folder_id')
    const id = searchParams.get('id')
    const wantSigned = searchParams.get('signed') === '1'

    // If requesting a signed URL for a specific doc
    if (wantSigned && id) {
      const { data: row, error: readOneErr } = await supabase
        .from('admin_documents')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (readOneErr) throw readOneErr
      if (!row) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
      const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(row.path, 300)
      if (signErr) return NextResponse.json({ success: false, message: signErr.message }, { status: 400 })
      return NextResponse.json({ success: true, url: signed?.signedUrl })
    }

    let query = supabase.from('admin_documents').select('*').order('created_at', { ascending: false })
    if (folder_id) query = query.eq('folder_id', folder_id)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to list documents' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED', message: 'Not authenticated' }, { status: 401 })
    }
    const userId = userRes.user.id
    
    // Admin-only
    const { data: me } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Admin access required' }, { status: 403 })
    }

    // Parse FormData - Next.js should handle this automatically
    let form: FormData
    try {
      // Check content type
      const contentType = request.headers.get('content-type') || ''
      console.log('Request Content-Type:', contentType)
      
      if (!contentType.includes('multipart/form-data')) {
        console.warn('Unexpected Content-Type, but attempting to parse as FormData anyway')
      }
      
      form = await request.formData()
    } catch (formError: any) {
      console.error('Error parsing FormData:', formError)
      console.error('Error stack:', formError?.stack)
      return NextResponse.json({ 
        success: false, 
        code: 'PARSE_ERROR', 
        message: 'Failed to parse form data. Please ensure files are properly selected.',
        error: process.env.NODE_ENV === 'development' ? formError?.message : undefined
      }, { status: 400 })
    }

    const folder_id = form.get('folder_id') as string | null
    
    // Handle multiple files - check both 'file' and 'files' keys for backward compatibility
    const files: File[] = []
    
    // Debug: Log all form entries
    const formEntries: string[] = []
    const formKeys = new Set<string>()
    
    for (const [key, value] of form.entries()) {
      formKeys.add(key)
      if (value instanceof File) {
        formEntries.push(`${key}: File(${value.name}, ${value.size} bytes, ${value.type || 'no type'})`)
      } else {
        formEntries.push(`${key}: ${String(value).substring(0, 50)}`)
      }
    }
    
    console.log('FormData keys found:', Array.from(formKeys))
    console.log('FormData entries:', formEntries)
    
    // Try to get files using getAll (for multiple files with key 'files')
    const fileEntries = form.getAll('files')
    console.log(`Found ${fileEntries.length} entries with key 'files'`)
    
    // Also check for single 'file' key
    const singleFile = form.get('file')
    console.log(`Single 'file' entry:`, singleFile instanceof File ? `File(${singleFile.name})` : singleFile ? `Non-File: ${typeof singleFile}` : 'none')
    
    // Also check for any other file-like entries (in case key name is different)
    const allFiles: File[] = []
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        allFiles.push(value)
        console.log(`Found file with key '${key}': ${value.name}`)
      }
    }
    
    // Process file entries - prioritize 'files' array, then 'file' single, then any other files
    if (fileEntries && fileEntries.length > 0) {
      fileEntries.forEach((entry, index) => {
        if (entry instanceof File) {
          console.log(`Adding file ${index + 1} from 'files' array: ${entry.name} (${entry.size} bytes, type: ${entry.type || 'unknown'})`)
          files.push(entry)
        } else {
          console.warn(`Entry ${index + 1} in 'files' array is not a File instance:`, typeof entry, entry)
        }
      })
    } else if (singleFile instanceof File) {
      // Single file (backward compatibility)
      console.log(`Adding single file from 'file' key: ${singleFile.name}`)
      files.push(singleFile)
    } else if (allFiles.length > 0) {
      // Fallback: use any files found with other keys
      console.log(`Using ${allFiles.length} files found with other keys`)
      files.push(...allFiles)
    }
    
    console.log(`Total files to process: ${files.length}`)
    
    if (files.length === 0) {
      return NextResponse.json({ 
        success: false, 
        code: 'VALIDATION_ERROR', 
        message: 'No file provided. Please select at least one file to upload.',
        debug: process.env.NODE_ENV === 'development' ? {
          formKeys: Array.from(formKeys),
          formEntries: formEntries,
          fileEntriesCount: fileEntries.length,
          singleFileExists: singleFile !== null,
          allFilesFound: allFiles.length,
          contentType: request.headers.get('content-type')
        } : undefined
      }, { status: 400 })
    }

    const uploadedDocs: any[] = []
    const errors: { fileName: string; reason: string }[] = []

    // Process each file
    for (const file of files) {
      try {
        // Validate file size
        if (file.size > MAX_FILE_SIZE_BYTES) {
          errors.push({ fileName: file.name, reason: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.` })
          continue
        }

        // Validate file type
        if (ALLOWLIST.length && !ALLOWLIST.includes(file.type)) {
          // Try to infer type from extension if MIME type is missing
          const ext = file.name.split('.').pop()?.toLowerCase()
          const mimeMap: Record<string, string> = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg'
          }
          const inferredType = ext ? mimeMap[ext] : null
          
          if (!inferredType || !ALLOWLIST.includes(inferredType)) {
            errors.push({ 
              fileName: file.name, 
              reason: `File type not allowed. Allowed types: PDF, Word (DOC/DOCX), Images (PNG/JPG/JPEG).` 
            })
            continue
          }
          
          // Use inferred type if original was missing
          if (!file.type && inferredType) {
            Object.defineProperty(file, 'type', { value: inferredType, writable: false })
          }
        }

        const objectName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectName, await file.arrayBuffer(), {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })
        if (upErr) {
          errors.push({ fileName: file.name, reason: `Upload failed: ${upErr.message}` })
          continue
        }

        const payload: AdminDocumentInsert = {
          user_id: userId,
          path: objectName,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          folder_id: folder_id || null
        }
        
        // Note: display_name column doesn't exist in admin_documents table
        // Using file_name as the display name instead

        const { data, error } = await supabase
          .from('admin_documents')
          .insert(payload)
          .select()
          .single()
        if (error) {
          errors.push({ fileName: file.name, reason: `Database error: ${error.message}` })
          // Try to clean up uploaded file
          await supabase.storage.from(BUCKET).remove([objectName])
          continue
        }
        
        uploadedDocs.push(data)
      } catch (fileError: any) {
        errors.push({ fileName: file.name, reason: fileError?.message || 'Unknown error' })
      }
    }

    // Return results
    if (uploadedDocs.length === 0 && errors.length > 0) {
      console.error('All files failed to upload:', errors)
      return NextResponse.json({ 
        success: false, 
        code: 'UPLOAD_FAILED', 
        message: errors.length === 1 
          ? `Upload failed: ${errors[0].reason}` 
          : `All ${errors.length} files failed to upload. See errors for details.`,
        errors 
      }, { status: 400 })
    }

    console.log(`Upload complete: ${uploadedDocs.length} successful, ${errors.length} failed`)
    return NextResponse.json({ 
      success: true, 
      data: uploadedDocs,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: files.length,
        uploaded: uploadedDocs.length,
        failed: errors.length
      }
    })
  } catch (e: any) {
    console.error('POST /api/admin-documents error:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to upload document',
      error: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED', message: 'Not authenticated' }, { status: 401 })
    }
    const userId = userRes.user.id
    // Admin-only
    const { data: me } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, display_name } = body
    if (!id) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Missing id' }, { status: 400 })
    }
    
    // Note: display_name column doesn't exist in admin_documents table
    // Update file_name instead if display_name is provided
    if (display_name && display_name.trim() !== '') {
      const { data, error } = await supabase
        .from('admin_documents')
        .update({ file_name: display_name.trim() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data })
    } else {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Display name is required' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('PUT /api/admin-documents error:', e)
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED', message: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Missing id' }, { status: 400 })

    const { data: row, error: readErr } = await supabase
      .from('admin_documents')
      .select('*')
      .eq('id', id)
      .single()
    if (readErr) throw readErr

    const { error: delObjErr } = await supabase.storage.from(BUCKET).remove([row.path])
    if (delObjErr) throw delObjErr

    const { error: delRowErr } = await supabase
      .from('admin_documents')
      .delete()
      .eq('id', id)
    if (delRowErr) throw delRowErr

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to delete document' }, { status: 500 })
  }
}
