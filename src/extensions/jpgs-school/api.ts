import { defineOverlayExtension } from '@overlay/extension-sdk'
import {
  JPGS_ADMIN_OVERVIEW,
  JPGS_PARENT_OVERVIEW,
  JPGS_TEACHER_OVERVIEW,
} from './data'

export const jpgsSchoolApiExtension = defineOverlayExtension({
  id: 'jpgs-school',
  version: '1.0.0',
  apiHandlers: [
    {
      method: 'GET',
      path: '/teacher/overview',
      handler: async (_request, context) => {
        return Response.json({
          userId: context.userId,
          ...JPGS_TEACHER_OVERVIEW,
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
          ...JPGS_PARENT_OVERVIEW,
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
          ...JPGS_ADMIN_OVERVIEW,
          updatedAt: Date.now(),
        })
      },
    },
  ],
})
