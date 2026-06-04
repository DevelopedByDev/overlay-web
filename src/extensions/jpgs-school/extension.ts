import { defineOverlayExtension } from '@overlay/extension-sdk'

export const jpgsSchoolExtension = defineOverlayExtension({
  id: 'jpgs-school',
  version: '1.0.0',
  navigation: [
    {
      id: 'jpgs-teacher',
      label: 'JPGS Teacher',
      href: '/app/x/jpgs-teacher',
      icon: 'user',
      componentKey: 'jpgs.modules.teacherDashboard',
    },
    {
      id: 'jpgs-parent',
      label: 'JPGS Parent',
      href: '/app/x/jpgs-parent',
      icon: 'mail',
      componentKey: 'jpgs.modules.parentDashboard',
    },
    {
      id: 'jpgs-admin',
      label: 'JPGS Admin',
      href: '/app/x/jpgs-admin',
      icon: 'shield-check',
      componentKey: 'jpgs.modules.adminDashboard',
    },
  ],
  featureModules: [
    {
      id: 'jpgs-teacher-dashboard',
      label: 'JPGS Teacher',
      description: 'Teacher dashboard for IB, Cambridge IGCSE, and CBSE classroom operations.',
      navigationItemId: 'jpgs-teacher',
      routePatterns: ['/app/x/jpgs-teacher'],
      componentKey: 'jpgs.modules.teacherDashboard',
      packageName: 'src/extensions/jpgs-school',
      order: 82,
    },
    {
      id: 'jpgs-parent-dashboard',
      label: 'JPGS Parent',
      description: 'Parent-safe progress dashboard across IB, Cambridge IGCSE, and CBSE pathways.',
      navigationItemId: 'jpgs-parent',
      routePatterns: ['/app/x/jpgs-parent'],
      componentKey: 'jpgs.modules.parentDashboard',
      packageName: 'src/extensions/jpgs-school',
      order: 83,
    },
    {
      id: 'jpgs-admin-dashboard',
      label: 'JPGS Admin',
      description: 'Administrative dashboard for curriculum operations, compliance, and AI rollout governance.',
      navigationItemId: 'jpgs-admin',
      routePatterns: ['/app/x/jpgs-admin'],
      componentKey: 'jpgs.modules.adminDashboard',
      packageName: 'src/extensions/jpgs-school',
      order: 84,
    },
  ],
  policyGates: [
    {
      id: 'jpgs-dashboards',
      label: 'JPGS Dashboards',
      description: 'Controls access to JPGS teacher, parent, and admin extension dashboards.',
      defaultEnabled: true,
      enforcement: 'disable',
    },
  ],
})
