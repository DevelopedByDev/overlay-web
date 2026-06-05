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

export type StudentQuizQuestion = {
  id: string
  prompt: string
  options: string[]
  answerIndex: number
  explanation: string
  strand: string
}

export type StudentQuiz = {
  id: string
  title: string
  paper: string
  timeLimit: string
  objective: string
  questions: StudentQuizQuestion[]
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
  quizzes: StudentQuiz[]
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
  feedbackQueue: Array<{
    id: string
    student: string
    investigation: string
    criterion: string
    signal: string
  }>
  rubricCriteria: Array<{
    id: string
    label: string
    max: number
    descriptor: string
  }>
}

export type ParentOverview = {
  parentName: string
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
  supportChecklist: Array<{
    id: string
    title: string
    detail: string
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
  adminName: string
  school: string
  metrics: DashboardMetric[]
  curriculumOps: CurriculumReadiness[]
  authorizationEvidence: Array<{
    id: string
    label: string
    detail: string
    owner: string
    complete: boolean
  }>
  policyChecks: Array<{
    id: string
    label: string
    detail: string
    status: 'Ready' | 'Needs review' | 'Blocked'
  }>
}

export const JPIS_STUDENT_OVERVIEW: StudentOverview = {
  studentName: 'Ananya Sharma',
  gradeLabel: 'IB DP Year 1',
  school: 'Jayshree Periwal International School',
  metrics: [
    {
      id: 'tasks',
      label: 'Open tasks',
      value: '5',
      detail: 'IA evidence, quiz corrections, and advisor reflections',
    },
    {
      id: 'practice',
      label: 'Physics quizzes',
      value: '2',
      detail: 'Paper 1 style checks available now',
    },
    {
      id: 'readiness',
      label: 'Readiness',
      value: '76%',
      detail: 'Based on DP Physics mechanics and electricity strands',
    },
  ],
  learningTracks: [
    {
      id: 'student-physics',
      curriculum: 'IB DP',
      subject: 'Physics HL',
      status: 'Needs practice',
      detail: 'Mechanics confidence is improving; electric circuits need targeted Paper 1 practice.',
      readiness: 72,
    },
    {
      id: 'student-core',
      curriculum: 'IB Core',
      subject: 'TOK, CAS, and learner profile reflection',
      status: 'On track',
      detail: 'Reflection evidence is current; the next CAS entry needs a clearer outcome connection.',
      readiness: 82,
    },
  ],
  focusQueue: [
    {
      id: 'focus-ia',
      title: 'Physics IA research question',
      detail: 'Narrow the independent variable and add one uncertainty note before supervisor review.',
      action: 'Open IA checklist',
    },
    {
      id: 'focus-circuits',
      title: 'Electric circuits practice',
      detail: 'Complete the internal resistance quiz and review both explanations.',
      action: 'Start quiz',
    },
    {
      id: 'focus-cas',
      title: 'CAS reflection link',
      detail: 'Connect the service activity to one learner profile attribute.',
      action: 'Draft reflection',
    },
  ],
  upcoming: [
    {
      id: 'student-upcoming-quiz',
      dateLabel: 'Today',
      title: 'IB Physics Paper 1 practice',
      detail: 'Mechanics and electricity quiz set is ready.',
    },
    {
      id: 'student-upcoming-ia',
      dateLabel: 'Friday',
      title: 'Physics IA supervisor check-in',
      detail: 'Submit research question, variable table, and uncertainty notes.',
    },
  ],
  quizzes: [
    {
      id: 'mechanics',
      title: 'Mechanics: forces and momentum',
      paper: 'IB Physics Paper 1',
      timeLimit: '6 minutes',
      objective: 'Check Newton laws, impulse, and momentum conservation.',
      questions: [
        {
          id: 'mechanics-q1',
          prompt: 'A 0.20 kg trolley accelerates at 1.5 m s^-2. What is the resultant force?',
          options: ['0.13 N', '0.30 N', '1.7 N', '7.5 N'],
          answerIndex: 1,
          explanation: 'Use F = ma. The force is 0.20 x 1.5 = 0.30 N.',
          strand: 'Forces',
        },
        {
          id: 'mechanics-q2',
          prompt: 'A ball rebounds from a wall with the same speed. Which quantity changes?',
          options: ['Mass only', 'Speed only', 'Velocity and momentum', 'Kinetic energy only'],
          answerIndex: 2,
          explanation: 'Direction reverses, so velocity and momentum change even when speed is unchanged.',
          strand: 'Momentum',
        },
        {
          id: 'mechanics-q3',
          prompt: 'The area under a force-time graph gives which quantity?',
          options: ['Power', 'Impulse', 'Displacement', 'Kinetic energy'],
          answerIndex: 1,
          explanation: 'Impulse equals force multiplied by time, so it is the graph area.',
          strand: 'Impulse',
        },
      ],
    },
    {
      id: 'electricity',
      title: 'Electricity: circuits and internal resistance',
      paper: 'IB Physics Paper 1',
      timeLimit: '7 minutes',
      objective: 'Check current, terminal potential difference, and internal resistance.',
      questions: [
        {
          id: 'electricity-q1',
          prompt: 'A 6.0 V cell with internal resistance 1.0 ohm supplies 2.0 A. What is the terminal p.d.?',
          options: ['2.0 V', '4.0 V', '6.0 V', '8.0 V'],
          answerIndex: 1,
          explanation: 'Terminal p.d. = emf - Ir = 6.0 - (2.0 x 1.0) = 4.0 V.',
          strand: 'Internal resistance',
        },
        {
          id: 'electricity-q2',
          prompt: 'Two identical resistors are connected in parallel. What happens to total resistance?',
          options: ['It doubles', 'It halves', 'It is unchanged', 'It becomes zero'],
          answerIndex: 1,
          explanation: 'For two equal resistors in parallel, total resistance is half of one resistor.',
          strand: 'Parallel circuits',
        },
        {
          id: 'electricity-q3',
          prompt: 'Conventional current is defined as the flow of which charge?',
          options: ['Negative charge only', 'Positive charge', 'Neutrons', 'Photons'],
          answerIndex: 1,
          explanation: 'Conventional current is defined as the direction of positive charge flow.',
          strand: 'Current',
        },
      ],
    },
  ],
}

export const JPIS_TEACHER_OVERVIEW: TeacherOverview = {
  teacherName: 'Dr. Meera Kapoor',
  school: 'Jayshree Periwal International School',
  metrics: [
    {
      id: 'classes',
      label: 'Active classes',
      value: '4',
      detail: 'IB DP Physics HL and SL sections',
    },
    {
      id: 'review',
      label: 'IA drafts',
      value: '18',
      detail: 'Exploration and analysis feedback pending',
    },
    {
      id: 'interventions',
      label: 'Interventions due',
      value: '7',
      detail: 'Students below target in mechanics or circuits',
    },
  ],
  curriculumReadiness: [
    {
      id: 'physics-hl',
      name: 'IB DP Physics HL',
      readiness: 76,
      focus: 'Mechanics, fields, and IA exploration evidence need the next feedback cycle.',
      owner: 'Physics faculty',
    },
    {
      id: 'ib-core',
      name: 'IB Core alignment',
      readiness: 84,
      focus: 'Learner profile and ATL reflection prompts are ready for this unit.',
      owner: 'IB coordinator',
    },
  ],
  today: [
    {
      id: 'lesson-mechanics',
      time: '08:20',
      title: 'DP Physics HL: circular motion',
      detail: 'Use quiz misses to group students for centripetal force practice.',
    },
    {
      id: 'lesson-electricity',
      time: '10:10',
      title: 'DP Physics SL: internal resistance',
      detail: 'Run a diagnostic on terminal p.d. and energy transfer in circuits.',
    },
  ],
  feedbackQueue: [
    {
      id: 'feedback-ananya',
      student: 'Ananya Sharma',
      investigation: 'How wire length affects resistance',
      criterion: 'Exploration',
      signal: 'Variables are identified, but uncertainty treatment is thin.',
    },
    {
      id: 'feedback-maanav',
      student: 'Maanav S.',
      investigation: 'Magnetic damping in a copper pipe',
      criterion: 'Analysis',
      signal: 'Graph selection is good; gradient interpretation needs correction.',
    },
    {
      id: 'feedback-isha',
      student: 'Isha R.',
      investigation: 'Pendulum damping and amplitude decay',
      criterion: 'Evaluation',
      signal: 'Limitations are listed but not linked to specific improvements.',
    },
  ],
  rubricCriteria: [
    {
      id: 'personal',
      label: 'Personal engagement',
      max: 2,
      descriptor: 'Student ownership, curiosity, and purposeful design choices.',
    },
    {
      id: 'exploration',
      label: 'Exploration',
      max: 6,
      descriptor: 'Research question, variables, method, and safety/ethics.',
    },
    {
      id: 'analysis',
      label: 'Analysis',
      max: 6,
      descriptor: 'Data processing, uncertainty, graphs, and scientific reasoning.',
    },
    {
      id: 'evaluation',
      label: 'Evaluation',
      max: 6,
      descriptor: 'Conclusion, limitations, and realistic improvements.',
    },
    {
      id: 'communication',
      label: 'Communication',
      max: 4,
      descriptor: 'Structure, terminology, units, citations, and clarity.',
    },
  ],
}

export const JPIS_PARENT_OVERVIEW: ParentOverview = {
  parentName: 'Rohan Sharma',
  studentName: 'Ananya Sharma',
  gradeLabel: 'IB DP Year 1',
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
      label: 'Family actions',
      value: '3',
      detail: 'IA, quiz review, and CAS conversation',
    },
    {
      id: 'checkpoints',
      label: 'IB checkpoints',
      value: '2',
      detail: 'Physics IA review and advisor meeting',
    },
  ],
  progress: [
    {
      id: 'progress-physics',
      curriculum: 'IB DP',
      subject: 'Physics HL readiness',
      status: 'Needs practice',
      detail: 'Mechanics is improving; electricity quiz explanations need parent-supported review time.',
      readiness: 68,
    },
    {
      id: 'progress-core',
      curriculum: 'IB Core',
      subject: 'CAS and learner profile reflection',
      status: 'On track',
      detail: 'Reflection quality is good; the next conversation should connect action to outcome.',
      readiness: 82,
    },
  ],
  supportChecklist: [
    {
      id: 'support-quiz',
      title: 'Review Physics quiz explanations',
      detail: 'Ask Ananya to explain internal resistance and terminal potential difference aloud.',
    },
    {
      id: 'support-ia',
      title: 'Confirm IA planning block',
      detail: 'Set aside 45 minutes for variables, uncertainty, and safety notes.',
    },
    {
      id: 'support-cas',
      title: 'Discuss CAS outcome',
      detail: 'Prompt one example of how the service activity showed an IB learner profile attribute.',
    },
  ],
  upcoming: [
    {
      id: 'upcoming-ptm',
      dateLabel: 'Tomorrow',
      title: 'Parent teacher meeting',
      detail: 'Academic advisor and Physics faculty.',
    },
    {
      id: 'upcoming-ia',
      dateLabel: 'Friday',
      title: 'Physics IA supervisor check-in',
      detail: 'Review research question, variable table, and uncertainty notes.',
    },
  ],
  messages: [
    {
      id: 'message-advisor',
      from: 'Academic advisor',
      title: 'Weekly IB progress summary ready',
      detail: 'Approved family-facing summary across attendance, effort, and next steps.',
    },
    {
      id: 'message-physics',
      from: 'Physics faculty',
      title: 'Quiz explanations need review',
      detail: 'Two Paper 1 explanations are marked for discussion at home.',
    },
  ],
}

export const JPIS_ADMIN_OVERVIEW: AdminOverview = {
  adminName: 'Priya Menon',
  school: 'Jayshree Periwal International School',
  metrics: [
    {
      id: 'learners',
      label: 'IB learners',
      value: '820',
      detail: 'PYP, MYP, and DP students in active tracking',
    },
    {
      id: 'adoption',
      label: 'Faculty adoption',
      value: '72%',
      detail: 'Weekly active use of approved IB workflows',
    },
    {
      id: 'risks',
      label: 'Open risk flags',
      value: '9',
      detail: 'Academic, authorization, and pastoral queues',
    },
    {
      id: 'programs',
      label: 'IB programs',
      value: '3',
      detail: 'PYP, MYP, and DP operating views',
    },
  ],
  curriculumOps: [
    {
      id: 'admin-dp',
      name: 'IB DP Physics and core evidence',
      readiness: 78,
      focus: 'IA moderation, predicted grade evidence, TOK/CAS alignment, and assessment calendars.',
      owner: 'DP coordinator',
    },
    {
      id: 'admin-myp',
      name: 'MYP unit planning evidence',
      readiness: 84,
      focus: 'ATL skills, inquiry questions, and reflection artifacts are current for the review cycle.',
      owner: 'MYP coordinator',
    },
  ],
  authorizationEvidence: [
    {
      id: 'evidence-unit-planners',
      label: 'Unit planners',
      detail: 'PYP/MYP/DP planners mapped to inquiry, ATL, and assessment criteria.',
      owner: 'IB coordinators',
      complete: true,
    },
    {
      id: 'evidence-assessment',
      label: 'Assessment samples',
      detail: 'Physics IA samples and moderation notes need final coordinator review.',
      owner: 'DP coordinator',
      complete: false,
    },
    {
      id: 'evidence-cas',
      label: 'CAS and learner profile evidence',
      detail: 'CAS reflections are collected; learner profile tagging is in progress.',
      owner: 'CAS advisor',
      complete: false,
    },
  ],
  policyChecks: [
    {
      id: 'policy-student-ai',
      label: 'Student AI use policy',
      detail: 'Approved for quiz explanations and reflection drafting with teacher review.',
      status: 'Ready',
    },
    {
      id: 'policy-parent-view',
      label: 'Parent-safe summaries',
      detail: 'Raw teacher notes are hidden; only approved family-facing summaries are visible.',
      status: 'Ready',
    },
    {
      id: 'policy-data-sync',
      label: 'SIS and LMS sync',
      detail: 'Needs final mapping for attendance and assessment imports.',
      status: 'Needs review',
    },
  ],
}
