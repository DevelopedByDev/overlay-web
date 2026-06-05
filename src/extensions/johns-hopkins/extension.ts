import { defineOverlayExtension } from '@overlay/extension-sdk'

export const johnsHopkinsExtension = defineOverlayExtension({
  id: 'johns-hopkins',
  version: '1.0.0',
  navigation: [
    {
      id: 'student-dashboard',
      label: 'Student',
      href: '/app/x/student',
      icon: 'sparkles',
      componentKey: 'university.modules.studentDashboard',
    },
    {
      id: 'professor-dashboard',
      label: 'Professor',
      href: '/app/x/professor',
      icon: 'user',
      componentKey: 'university.modules.professorDashboard',
    },
    {
      id: 'admin-dashboard',
      label: 'Admin',
      href: '/app/x/admin',
      icon: 'shield-check',
      componentKey: 'university.modules.adminDashboard',
    },
  ],
  featureModules: [
    {
      id: 'student-dashboard',
      label: 'Student',
      description: 'Johns Hopkins student dashboard for coursework, research matching, and advising.',
      navigationItemId: 'student-dashboard',
      routePatterns: ['/app/x/student'],
      componentKey: 'university.modules.studentDashboard',
      packageName: 'src/extensions/johns-hopkins',
      order: 80,
    },
    {
      id: 'professor-dashboard',
      label: 'Professor',
      description: 'Johns Hopkins professor dashboard for advising, course signals, and research operations.',
      navigationItemId: 'professor-dashboard',
      routePatterns: ['/app/x/professor'],
      componentKey: 'university.modules.professorDashboard',
      packageName: 'src/extensions/johns-hopkins',
      order: 81,
    },
    {
      id: 'admin-dashboard',
      label: 'Admin',
      description: 'Johns Hopkins administrative dashboard for student success, compliance, and operations.',
      navigationItemId: 'admin-dashboard',
      routePatterns: ['/app/x/admin'],
      componentKey: 'university.modules.adminDashboard',
      packageName: 'src/extensions/johns-hopkins',
      order: 82,
    },
  ],
  policyGates: [
    {
      id: 'university-dashboards',
      label: 'University Dashboards',
      description: 'Controls access to student, professor, and admin extension dashboards.',
      defaultEnabled: true,
      enforcement: 'disable',
    },
  ],
})
