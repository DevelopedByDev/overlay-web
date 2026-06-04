export type DashboardMetric = {
  id: string
  label: string
  value: string
  detail: string
}

export type CurriculumReadiness = {
  id: string
  name: string
  readiness: number
  focus: string
  owner: string
}

export type TeacherOverview = {
  teacherName: string
  campus: string
  metrics: DashboardMetric[]
  curriculumReadiness: CurriculumReadiness[]
  today: Array<{
    id: string
    time: string
    title: string
    detail: string
  }>
  aiWorkflows: Array<{
    id: string
    label: string
    detail: string
  }>
  atRisk: Array<{
    id: string
    cohort: string
    signal: string
    action: string
  }>
}

export type ParentOverview = {
  studentName: string
  gradeLabel: string
  campus: string
  metrics: DashboardMetric[]
  progress: Array<{
    id: string
    curriculum: string
    subject: string
    status: string
    detail: string
    readiness: number
  }>
  attention: Array<{
    id: string
    title: string
    detail: string
    owner: string
  }>
  upcoming: Array<{
    id: string
    dateLabel: string
    title: string
    detail: string
  }>
  messages: Array<{
    id: string
    from: string
    title: string
    detail: string
  }>
}

export type AdminOverview = {
  schoolGroup: string
  metrics: DashboardMetric[]
  curriculumOps: CurriculumReadiness[]
  compliance: Array<{
    id: string
    label: string
    detail: string
    due: string
    status: 'On track' | 'Needs review' | 'Blocked'
  }>
  aiAdoption: Array<{
    id: string
    role: string
    adoption: number
    detail: string
  }>
  executiveActions: Array<{
    id: string
    title: string
    detail: string
    owner: string
  }>
}

export const JPGS_TEACHER_OVERVIEW: TeacherOverview = {
  teacherName: 'JPGS Faculty',
  campus: 'Jayshree Periwal Group of Schools',
  metrics: [
    {
      id: 'classes',
      label: 'Active classes',
      value: '9',
      detail: 'IB DP, IGCSE, and CBSE cohorts',
    },
    {
      id: 'review',
      label: 'Work to review',
      value: '46',
      detail: 'IA drafts, mocks, notebooks, and rubrics',
    },
    {
      id: 'interventions',
      label: 'Interventions due',
      value: '12',
      detail: 'Students flagged by mastery and attendance signals',
    },
  ],
  curriculumReadiness: [
    {
      id: 'ib',
      name: 'IB PYP/MYP/DP',
      readiness: 78,
      focus: 'TOK reflections, IA feedback, and CAS evidence are due this cycle.',
      owner: 'IB coordinator',
    },
    {
      id: 'igcse',
      name: 'Cambridge IGCSE',
      readiness: 71,
      focus: 'Physics mock analysis and coursework evidence need final review.',
      owner: 'Cambridge lead',
    },
    {
      id: 'cbse',
      name: 'CBSE',
      readiness: 84,
      focus: 'Grade 10 Mathematics pre-board remediation is ahead of plan.',
      owner: 'CBSE academic lead',
    },
  ],
  today: [
    {
      id: 'lesson-ib-econ',
      time: '08:20',
      title: 'IB DP Economics HL',
      detail: 'Use uploaded exemplar essays to generate Paper 1 feedback groups.',
    },
    {
      id: 'lesson-igcse-science',
      time: '10:10',
      title: 'IGCSE Coordinated Sciences',
      detail: 'Run a 12-minute misconceptions check on electricity and circuits.',
    },
    {
      id: 'lesson-cbse-math',
      time: '12:00',
      title: 'CBSE Grade 10 Mathematics',
      detail: 'Create differentiated practice for quadratic equations and AP.',
    },
  ],
  aiWorkflows: [
    {
      id: 'worksheet',
      label: 'Differentiated worksheet',
      detail: 'Generate three levels from the current unit plan and JPGS question bank.',
    },
    {
      id: 'formative',
      label: 'Formative check',
      detail: 'Create exit tickets mapped to IB criteria, Cambridge objectives, or CBSE outcomes.',
    },
    {
      id: 'parent-note',
      label: 'Parent-safe note',
      detail: 'Summarize progress without exposing private teacher notes.',
    },
    {
      id: 'reflection',
      label: 'ATL reflection prompt',
      detail: 'Draft IB learner profile and ATL prompts from classroom evidence.',
    },
  ],
  atRisk: [
    {
      id: 'risk-ib-cas',
      cohort: 'IB DP Year 1',
      signal: 'CAS reflections have not been updated for 11 students.',
      action: 'Send advisor checklist',
    },
    {
      id: 'risk-igcse-coursework',
      cohort: 'IGCSE Grade 10',
      signal: 'Coursework evidence is missing for 6 science submissions.',
      action: 'Open evidence queue',
    },
    {
      id: 'risk-cbse-preboard',
      cohort: 'CBSE Grade 10',
      signal: 'Algebra mastery is below target for Section B.',
      action: 'Generate practice set',
    },
  ],
}

export const JPGS_PARENT_OVERVIEW: ParentOverview = {
  studentName: 'Ananya P.',
  gradeLabel: 'Grade 10 transition track',
  campus: 'Jayshree Periwal Group of Schools',
  metrics: [
    {
      id: 'attendance',
      label: 'Attendance',
      value: '94%',
      detail: 'Above the current school threshold',
    },
    {
      id: 'tasks',
      label: 'Open tasks',
      value: '5',
      detail: 'Two need parent acknowledgement',
    },
    {
      id: 'checkpoints',
      label: 'Upcoming checkpoints',
      value: '4',
      detail: 'Mock, PTM, submission, and planner review',
    },
  ],
  progress: [
    {
      id: 'progress-ib',
      curriculum: 'IB',
      subject: 'ATL and reflection habits',
      status: 'Building consistency',
      detail: 'Weekly reflection quality is improving; evidence upload cadence is uneven.',
      readiness: 69,
    },
    {
      id: 'progress-igcse',
      curriculum: 'IGCSE',
      subject: 'Physics and Mathematics readiness',
      status: 'Needs practice',
      detail: 'Mock analysis shows errors in electricity diagrams and algebraic manipulation.',
      readiness: 63,
    },
    {
      id: 'progress-cbse',
      curriculum: 'CBSE',
      subject: 'Board-style problem solving',
      status: 'On track',
      detail: 'Pre-board revision is on pace after two targeted practice sets.',
      readiness: 81,
    },
  ],
  attention: [
    {
      id: 'attention-cas',
      title: 'Reflection journal update',
      detail: 'Advisor asked for one service-learning reflection before Friday.',
      owner: 'Student',
    },
    {
      id: 'attention-igcse',
      title: 'IGCSE mock corrections',
      detail: 'Physics corrections need a parent acknowledgement after review.',
      owner: 'Parent',
    },
    {
      id: 'attention-cbse',
      title: 'CBSE pre-board planner',
      detail: 'Mathematics revision plan has three pending practice sessions.',
      owner: 'Student',
    },
  ],
  upcoming: [
    {
      id: 'upcoming-ptm',
      dateLabel: 'Tomorrow',
      title: 'Parent teacher meeting',
      detail: 'Academic advisor, Mathematics, and Science faculty.',
    },
    {
      id: 'upcoming-igcse-mock',
      dateLabel: 'Monday',
      title: 'IGCSE Physics mock review',
      detail: 'Review marked paper and remediation plan.',
    },
    {
      id: 'upcoming-cbse-preboard',
      dateLabel: 'Next week',
      title: 'CBSE Mathematics pre-board',
      detail: 'Chapter-level readiness summary will refresh after practice set 3.',
    },
  ],
  messages: [
    {
      id: 'message-advisor',
      from: 'Academic advisor',
      title: 'Weekly progress summary ready',
      detail: 'Approved family-facing summary across attendance, effort, and next steps.',
    },
    {
      id: 'message-transport',
      from: 'Operations desk',
      title: 'Exam week transport confirmation',
      detail: 'Route timing confirmation requested for the mock exam week.',
    },
  ],
}

export const JPGS_ADMIN_OVERVIEW: AdminOverview = {
  schoolGroup: 'Jayshree Periwal Group of Schools',
  metrics: [
    {
      id: 'learners',
      label: 'Active learners',
      value: '5.4k',
      detail: 'Across IB, IGCSE, and CBSE programs',
    },
    {
      id: 'adoption',
      label: 'Teacher adoption',
      value: '68%',
      detail: 'Weekly active faculty using approved AI workflows',
    },
    {
      id: 'risks',
      label: 'Open risk flags',
      value: '14',
      detail: 'Academic, compliance, and pastoral queues',
    },
    {
      id: 'campuses',
      label: 'Campuses tracked',
      value: '7',
      detail: 'Group-level view with campus rollups',
    },
  ],
  curriculumOps: [
    {
      id: 'admin-ib',
      name: 'IB authorization and evidence',
      readiness: 76,
      focus: 'Unit planners, learner profile evidence, and CAS documentation are being normalized.',
      owner: 'Director, International Curriculum',
    },
    {
      id: 'admin-igcse',
      name: 'Cambridge IGCSE exam operations',
      readiness: 68,
      focus: 'Exam entries, coursework moderation, and mock analytics need cross-campus review.',
      owner: 'Cambridge exams officer',
    },
    {
      id: 'admin-cbse',
      name: 'CBSE audit and board readiness',
      readiness: 83,
      focus: 'Pre-board analytics and remediation reporting are above the current benchmark.',
      owner: 'CBSE principal office',
    },
  ],
  compliance: [
    {
      id: 'compliance-ib',
      label: 'IB documentation packet',
      detail: 'Evidence map for unit planners, reflection artifacts, and coordinator approvals.',
      due: 'Friday',
      status: 'Needs review',
    },
    {
      id: 'compliance-cambridge',
      label: 'Cambridge exam entries',
      detail: 'Final subject entries require campus confirmation before submission.',
      due: 'Monday',
      status: 'On track',
    },
    {
      id: 'compliance-cbse',
      label: 'CBSE inspection evidence',
      detail: 'Staff, infrastructure, and academic documents are staged for review.',
      due: 'Next week',
      status: 'On track',
    },
  ],
  aiAdoption: [
    {
      id: 'adoption-teachers',
      role: 'Teachers',
      adoption: 68,
      detail: 'Lesson prep, feedback drafting, worksheets, and parent-safe summaries.',
    },
    {
      id: 'adoption-students',
      role: 'Students',
      adoption: 52,
      detail: 'Revision plans, weak-topic practice, and approved research support.',
    },
    {
      id: 'adoption-admin',
      role: 'Administrators',
      adoption: 74,
      detail: 'Compliance trackers, meeting briefs, and campus reporting.',
    },
  ],
  executiveActions: [
    {
      id: 'action-data',
      title: 'Connect SIS attendance and assessment exports',
      detail: 'Replace static demo values with nightly JPGS data syncs.',
      owner: 'IT team',
    },
    {
      id: 'action-policy',
      title: 'Approve role-based AI policy gates',
      detail: 'Separate student, parent, teacher, and admin workflows before rollout.',
      owner: 'Leadership',
    },
    {
      id: 'action-pilot',
      title: 'Run three-campus pilot',
      detail: 'Pilot IB, Cambridge IGCSE, and CBSE dashboards with live faculty feedback.',
      owner: 'Academic operations',
    },
  ],
}
