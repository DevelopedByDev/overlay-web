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

export type StudentOverview = {
  studentName: string
  gradeLabel: string
  school: string
  metrics: DashboardMetric[]
  learningTracks: Array<{
    id: string
    curriculum: string
    subject: string
    status: string
    detail: string
    readiness: number
  }>
  focusQueue: Array<{
    id: string
    title: string
    detail: string
    action: string
  }>
  upcoming: Array<{
    id: string
    dateLabel: string
    title: string
    detail: string
  }>
  aiWorkflows: Array<{
    id: string
    label: string
    detail: string
  }>
}

export type TeacherOverview = {
  teacherName: string
  school: string
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
  school: string
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
  school: string
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

export const JPIS_STUDENT_OVERVIEW: StudentOverview = {
  studentName: 'Ananya P.',
  gradeLabel: 'IB / IGCSE pathway',
  school: 'Jayshree Periwal International School',
  metrics: [
    {
      id: 'tasks',
      label: 'Open tasks',
      value: '6',
      detail: 'IA evidence, mock corrections, and advisor reflections',
    },
    {
      id: 'practice',
      label: 'Practice sets',
      value: '18',
      detail: 'Teacher-approved revision generated this month',
    },
    {
      id: 'readiness',
      label: 'Readiness',
      value: '74%',
      detail: 'Average across IB and IGCSE focus areas',
    },
  ],
  learningTracks: [
    {
      id: 'student-ib',
      curriculum: 'IB',
      subject: 'Economics HL and TOK',
      status: 'On track',
      detail: 'Essay outlines are improving; TOK reflection evidence needs one more advisor review.',
      readiness: 78,
    },
    {
      id: 'student-igcse',
      curriculum: 'IGCSE',
      subject: 'Physics and Mathematics',
      status: 'Needs practice',
      detail: 'Mock analysis shows repeated errors in electricity diagrams and algebraic manipulation.',
      readiness: 69,
    },
  ],
  focusQueue: [
    {
      id: 'focus-ia',
      title: 'IB internal assessment evidence',
      detail: 'Add two source annotations before the next supervisor check-in.',
      action: 'Open checklist',
    },
    {
      id: 'focus-physics',
      title: 'IGCSE Physics correction set',
      detail: 'Redo circuit diagram questions from the mock review packet.',
      action: 'Start practice',
    },
    {
      id: 'focus-reflection',
      title: 'Advisor reflection',
      detail: 'Draft a short learner profile reflection from the last service activity.',
      action: 'Draft reflection',
    },
  ],
  upcoming: [
    {
      id: 'student-upcoming-mock',
      dateLabel: 'Monday',
      title: 'IGCSE Physics mock review',
      detail: 'Bring corrected paper and teacher feedback notes.',
    },
    {
      id: 'student-upcoming-ia',
      dateLabel: 'Friday',
      title: 'IB IA supervisor check-in',
      detail: 'Submit source annotations and research question update.',
    },
  ],
  aiWorkflows: [
    {
      id: 'workflow-plan',
      label: 'Study plan',
      detail: 'Turn teacher-approved tasks into a focused seven-day plan.',
    },
    {
      id: 'workflow-practice',
      label: 'Weak-topic practice',
      detail: 'Generate practice only from approved JPIS materials.',
    },
    {
      id: 'workflow-reflection',
      label: 'Reflection draft',
      detail: 'Prepare an advisor-safe reflection for review.',
    },
  ],
}

export const JPIS_TEACHER_OVERVIEW: TeacherOverview = {
  teacherName: 'JPIS Faculty',
  school: 'Jayshree Periwal International School',
  metrics: [
    {
      id: 'classes',
      label: 'Active classes',
      value: '7',
      detail: 'IB and Cambridge IGCSE cohorts',
    },
    {
      id: 'review',
      label: 'Work to review',
      value: '38',
      detail: 'IA drafts, mock corrections, rubrics, and reflections',
    },
    {
      id: 'interventions',
      label: 'Interventions due',
      value: '9',
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
  ],
  aiWorkflows: [
    {
      id: 'worksheet',
      label: 'Differentiated worksheet',
      detail: 'Generate three levels from the current unit plan and JPIS question bank.',
    },
    {
      id: 'formative',
      label: 'Formative check',
      detail: 'Create exit tickets mapped to IB criteria or Cambridge objectives.',
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
  ],
}

export const JPIS_PARENT_OVERVIEW: ParentOverview = {
  studentName: 'Ananya P.',
  gradeLabel: 'IB / IGCSE pathway',
  school: 'Jayshree Periwal International School',
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
      value: '4',
      detail: 'One needs parent acknowledgement',
    },
    {
      id: 'checkpoints',
      label: 'Upcoming checkpoints',
      value: '3',
      detail: 'Mock review, PTM, and IA supervisor check-in',
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

export const JPIS_ADMIN_OVERVIEW: AdminOverview = {
  school: 'Jayshree Periwal International School',
  metrics: [
    {
      id: 'learners',
      label: 'Active learners',
      value: '2.8k',
      detail: 'Across IB and Cambridge IGCSE programs',
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
      value: '11',
      detail: 'Academic, compliance, and pastoral queues',
    },
    {
      id: 'programs',
      label: 'Programs tracked',
      value: '2',
      detail: 'IB and Cambridge IGCSE operating views',
    },
  ],
  curriculumOps: [
    {
      id: 'admin-ib',
      name: 'IB authorization and evidence',
      readiness: 76,
      focus: 'Unit planners, learner profile evidence, and CAS documentation are being normalized.',
      owner: 'IB coordinator',
    },
    {
      id: 'admin-igcse',
      name: 'Cambridge IGCSE exam operations',
      readiness: 68,
      focus: 'Exam entries, coursework moderation, and mock analytics need review.',
      owner: 'Cambridge exams officer',
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
      detail: 'Final subject entries require confirmation before submission.',
      due: 'Monday',
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
      detail: 'Study plans, weak-topic practice, and approved research support.',
    },
    {
      id: 'adoption-admin',
      role: 'Administrators',
      adoption: 74,
      detail: 'Compliance trackers, meeting briefs, and program reporting.',
    },
  ],
  executiveActions: [
    {
      id: 'action-data',
      title: 'Connect SIS attendance and assessment exports',
      detail: 'Replace static demo values with nightly JPIS data syncs.',
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
      title: 'Run IB and IGCSE pilot',
      detail: 'Pilot dashboards with live faculty, parent, and student feedback.',
      owner: 'Academic operations',
    },
  ],
}
