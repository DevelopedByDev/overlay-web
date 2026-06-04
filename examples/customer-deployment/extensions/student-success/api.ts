import { defineOverlayExtension } from '@overlay/extension-sdk'

export const studentSuccessApiExtension = defineOverlayExtension({
  id: 'student-success',
  version: '1.0.0',
  apiHandlers: [
    {
      method: 'GET',
      path: '/overview',
      handler: async (_request, context) => {
        return Response.json({
          userId: context.userId,
          atRiskTopics: ['Algebra', 'Thermodynamics', 'Essay structure'],
          supportActions: 18,
          parentSummariesReady: 6,
        })
      },
    },
  ],
})
