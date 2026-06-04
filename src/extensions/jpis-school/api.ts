import { defineOverlayExtension } from '@overlay/extension-sdk'
import {
  JPIS_ADMIN_OVERVIEW,
  JPIS_PARENT_OVERVIEW,
  JPIS_STUDENT_OVERVIEW,
  JPIS_TEACHER_OVERVIEW,
} from './data'

export const jpisSchoolApiExtension = defineOverlayExtension({
  id: 'jpis-school',
  version: '1.0.0',
  apiHandlers: [
    {
      method: 'GET',
      path: '/student/overview',
      handler: async (_request, context) => {
        return Response.json({
          userId: context.userId,
          ...JPIS_STUDENT_OVERVIEW,
          updatedAt: Date.now(),
        })
      },
    },
    {
      method: 'GET',
      path: '/teacher/overview',
      handler: async (_request, context) => {
        return Response.json({
          userId: context.userId,
          ...JPIS_TEACHER_OVERVIEW,
          updatedAt: Date.now(),
        })
      },
    },
    {
      method: 'GET',
      path: '/parent/overview',
      handler: async (_request, context) => {
        return Response.json({
          userId: context.userId,
          ...JPIS_PARENT_OVERVIEW,
          updatedAt: Date.now(),
        })
      },
    },
    {
      method: 'GET',
      path: '/admin/overview',
      handler: async (_request, context) => {
        return Response.json({
          userId: context.userId,
          ...JPIS_ADMIN_OVERVIEW,
          updatedAt: Date.now(),
        })
      },
    },
  ],
})
