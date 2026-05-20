import { z } from 'zod'
import { AuthFields, BooleanQueryValue, IdQuery, IntegerQueryValue, UnknownResponse } from './common'

export const ProjectListQuery = z.object({
  projectId: IdQuery,
  updatedSince: IntegerQueryValue,
  includeDeleted: BooleanQueryValue,
})

export const CreateProjectRequest = z.object({
  ...AuthFields,
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
}).passthrough()

export const UpdateProjectRequest = CreateProjectRequest.partial().extend({
  ...AuthFields,
  projectId: z.string().min(1),
})

export const DeleteProjectRequest = z.object({
  ...AuthFields,
  projectId: z.string().min(1).optional(),
})

export const ProjectResponse = UnknownResponse
