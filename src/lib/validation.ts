import { z } from "zod"

export const AnnouncementCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.string().optional(),
  priority: z.union([z.string(), z.number()]).optional(),
  location: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  requirements: z.union([z.string(), z.array(z.string())]).optional(),
  created_by: z.string().uuid().optional(),
  facebook_post_url: z.string().url().nullable().optional(),
  source_type: z.enum(['MANUAL', 'FACEBOOK']).optional(),
})

export const AnnouncementUpdateSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.string().optional(),
  priority: z.union([z.string(), z.number()]).optional(),
  location: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  requirements: z.union([z.string(), z.array(z.string())]).optional(),
  updated_by: z.string().uuid().optional(),
  facebook_post_url: z.string().url().nullable().optional(),
  source_type: z.enum(['MANUAL', 'FACEBOOK']).optional(),
})

export const AnnouncementDeleteSchema = z.object({
  id: z.union([z.string(), z.number()]),
  deleted_by: z.string().uuid().optional(),
})

export const FeedbackCreateSchema = z.object({
  incident_id: z.string().uuid().nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  thumbs_up: z.coerce.boolean().optional(),
  comment: z.string().max(1000).nullable().optional(),
  created_by: z.string().uuid().optional(),
})

export type AnnouncementCreate = z.infer<typeof AnnouncementCreateSchema>
export type AnnouncementUpdate = z.infer<typeof AnnouncementUpdateSchema>
export type AnnouncementDelete = z.infer<typeof AnnouncementDeleteSchema>
export type FeedbackCreate = z.infer<typeof FeedbackCreateSchema>

export const IncidentCreateSchema = z.object({
  reporter_id: z.string().uuid(),
  incident_type: z.string().min(1),
  description: z.string().min(1),
  location_lat: z.coerce.number().min(-90).max(90),
  location_lng: z.coerce.number().min(-180).max(180),
  address: z.string().transform(val => val === '' ? null : val).nullable().optional(),
  barangay: z.string().min(1),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  photo_url: z.string().nullable().optional(),
  photo_urls: z.array(z.string()).max(3).optional(),
  voice_url: z.string().nullable().optional(),
  is_offline: z.coerce.boolean().optional(),
  created_at_local: z.string().optional(),
})

export type IncidentCreate = z.infer<typeof IncidentCreateSchema>

export const TrainingCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start_at: z.string().min(1),
  end_at: z.string().optional(),
  location: z.string().optional(),
  created_by: z.string().uuid().optional(),
})

export const TrainingEvaluationCreateSchema = z.object({
  training_id: z.union([z.string(), z.number()]),
  user_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comments: z.string().max(2000).optional(),
})

export const IncidentHandoffCreateSchema = z.object({
  incident_id: z.string().uuid(),
  from_lgu: z.string().min(1),
  to_lgu: z.string().min(1),
  notes: z.string().optional(),
  created_by: z.string().uuid().optional(),
})

export const IncidentHandoffUpdateSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "COMPLETED"]),
  notes: z.string().optional(),
  updated_by: z.string().uuid().optional(),
})

export type IncidentHandoffUpdate = z.infer<typeof IncidentHandoffUpdateSchema>


