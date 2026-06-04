import { defineOverlayExtension } from '@overlay/extension-sdk'

export const studentSuccessExtension = defineOverlayExtension({
  id: 'student-success',
  version: '1.0.0',
  navigation: [
    {
      id: 'student-success',
      label: 'Student Success',
      href: '/app/x/student-success',
      icon: 'sparkles',
      componentKey: 'school.modules.studentSuccess',
    },
  ],
  featureModules: [
    {
      id: 'student-success',
      label: 'Student Success',
      description: 'Revision planning, at-risk topic queues, and student support actions.',
      navigationItemId: 'student-success',
      routePatterns: ['/app/x/student-success'],
      componentKey: 'school.modules.studentSuccess',
      packageName: 'extensions/student-success',
      order: 80,
    },
  ],
  settingsSections: [{ id: 'student-success', label: 'Student Success', icon: 'sparkles' }],
  settingsPanels: [
    {
      id: 'student-success-policy',
      sectionId: 'student-success',
      label: 'Student Success Policy',
      componentKey: 'school.settings.studentSuccessPolicy',
      order: 10,
    },
  ],
  tools: [
    {
      id: 'student-success-revision-plan',
      label: 'Student revision plan',
      description: 'Create approved-source revision plans for students and cohorts.',
      category: 'knowledge',
      componentKey: 'school.tools.studentRevisionPlan',
    },
  ],
})
