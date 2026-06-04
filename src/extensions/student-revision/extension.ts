import { defineOverlayExtension } from '@overlay/extension-sdk'

export const studentRevisionExtension = defineOverlayExtension({
  id: 'student-revision',
  version: '1.0.0',
  navigation: [
    {
      id: 'student-revision',
      label: 'Student Revision',
      href: '/app/x/student-revision',
      icon: 'sparkles',
      componentKey: 'student.modules.revisionDashboard',
    },
  ],
  featureModules: [
    {
      id: 'student-revision',
      label: 'Student Revision',
      description: 'Student revision planning, weak-topic practice, and assessment preparation.',
      navigationItemId: 'student-revision',
      routePatterns: ['/app/x/student-revision'],
      componentKey: 'student.modules.revisionDashboard',
      packageName: 'src/extensions/student-revision',
      order: 80,
    },
  ],
  settingsSections: [
    {
      id: 'student-revision',
      label: 'Student Revision',
      icon: 'sparkles',
    },
  ],
  settingsPanels: [
    {
      id: 'student-revision-policy',
      sectionId: 'student-revision',
      label: 'Student Revision Policy',
      description: 'Controls for school-approved revision workflows.',
      componentKey: 'student.settings.revisionPolicy',
      order: 10,
    },
  ],
  tools: [
    {
      id: 'student-revision-plan',
      label: 'Revision planner',
      description: 'Create topic-aware student revision plans from approved school resources.',
      category: 'knowledge',
      componentKey: 'student.tools.revisionPlan',
      policyGateId: 'student-revision',
    },
  ],
  policyGates: [
    {
      id: 'student-revision',
      label: 'Student Revision',
      description: 'Controls access to student revision planning and weak-topic practice tools.',
      defaultEnabled: true,
      enforcement: 'disable',
    },
  ],
})
