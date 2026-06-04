import { defineOverlayExtension } from '@overlay/extension-sdk'

const weakTopics = [
  'Quadratic equations',
  'Organic chemistry mechanisms',
  'Macroeconomic diagrams',
]

export const studentRevisionApiExtension = defineOverlayExtension({
  id: 'student-revision',
  version: '1.0.0',
  apiHandlers: [
    {
      method: 'GET',
      path: '/overview',
      handler: async (_request, context) => {
        return Response.json({
          userId: context.userId,
          activePlans: 12,
          practiceSets: 48,
          weakTopics,
          upcomingAssessments: [
            { id: 'math-cbse-10', title: 'Grade 10 Mathematics', dateLabel: 'Friday' },
            { id: 'ibdp-econ', title: 'IBDP Economics Paper 1', dateLabel: 'Next week' },
          ],
          updatedAt: Date.now(),
        })
      },
    },
    {
      method: 'POST',
      path: '/plans',
      handler: async (_request, context) => {
        const subject =
          typeof context.parsedJson.subject === 'string' && context.parsedJson.subject.trim()
            ? context.parsedJson.subject.trim()
            : 'Mathematics'
        return Response.json({
          id: `revision_${Date.now()}`,
          subject,
          days: 14,
          createdBy: context.userId,
          checkpoints: ['Diagnose weak topics', 'Daily targeted practice', 'Mock assessment review'],
        })
      },
    },
  ],
})
