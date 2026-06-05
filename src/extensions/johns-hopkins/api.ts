import { defineOverlayExtension } from '@overlay/extension-sdk'
import {
  JOHNS_HOPKINS_ADMIN_OVERVIEW,
  JOHNS_HOPKINS_PROFESSOR_OVERVIEW,
  JOHNS_HOPKINS_STUDENT_OVERVIEW,
} from './data'

export const johnsHopkinsApiExtension = defineOverlayExtension({
  id: 'johns-hopkins',
  version: '1.0.0',
  apiHandlers: [
    {
      method: 'GET',
      path: '/student/overview',
      handler: async (_request, context) => {
        return Response.json({
          userId: context.userId,
          ...JOHNS_HOPKINS_STUDENT_OVERVIEW,
          updatedAt: Date.now(),
        })
      },
    },
    {
      method: 'GET',
      path: '/professor/overview',
      handler: async (_request, context) => {
        return Response.json({
          userId: context.userId,
          ...JOHNS_HOPKINS_PROFESSOR_OVERVIEW,
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
          ...JOHNS_HOPKINS_ADMIN_OVERVIEW,
          updatedAt: Date.now(),
        })
      },
    },
  ],
})
