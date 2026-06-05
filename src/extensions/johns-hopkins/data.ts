export type DashboardMetric = {
  id: string
  label: string
  value: string
  detail: string
}

export type ReadinessTrack = {
  id: string
  name: string
  readiness: number
  focus: string
  owner: string
}

export type StudentOpportunity = {
  id: string
  title: string
  lab: string
  match: number
  detail: string
  nextStep: string
}

export type StudentOverview = {
  studentName: string
  programLabel: string
  school: string
  metrics: DashboardMetric[]
  academicTracks: ReadinessTrack[]
  opportunityMatches: StudentOpportunity[]
  weeklyPlan: Array<{
    id: string
    title: string
    detail: string
    complete: boolean
  }>
  deadlines: Array<{
    id: string
    dateLabel: string
    title: string
    detail: string
  }>
}

export type ProfessorOverview = {
  professorName: string
  school: string
  metrics: DashboardMetric[]
  researchPipeline: ReadinessTrack[]
  grantSections: Array<{
    id: string
    label: string
    max: number
    descriptor: string
  }>
  advisingQueue: Array<{
    id: string
    student: string
    program: string
    signal: string
    recommendation: string
  }>
  courseSignals: Array<{
    id: string
    title: string
    detail: string
    severity: 'Low' | 'Medium' | 'High'
  }>
}

export type AdminOverview = {
  adminName: string
  school: string
  metrics: DashboardMetric[]
  operatingTracks: ReadinessTrack[]
  complianceWork: Array<{
    id: string
    label: string
    detail: string
    owner: string
    complete: boolean
  }>
  studentSuccessRisks: Array<{
    id: string
    segment: string
    signal: string
    action: string
    severity: 'Low' | 'Medium' | 'High'
  }>
}

export const JOHNS_HOPKINS_STUDENT_OVERVIEW: StudentOverview = {
  studentName: 'Maya Chen',
  programLabel: 'BME junior · pre-med track',
  school: 'Johns Hopkins University',
  metrics: [
    {
      id: 'credits',
      label: 'Credits this term',
      value: '17',
      detail: 'BME design, orgo lab, biostatistics, and research seminar',
    },
    {
      id: 'research',
      label: 'Research matches',
      value: '4',
      detail: 'Shortlisted labs from interests, skills, and schedule fit',
    },
    {
      id: 'risk',
      label: 'Workload risk',
      value: 'Medium',
      detail: 'Two lab deliverables and one midterm cluster this week',
    },
  ],
  academicTracks: [
    {
      id: 'track-bme',
      name: 'Biomedical Engineering design',
      readiness: 82,
      focus: 'Capstone prototype requirements are strong; validation plan needs tighter clinical context.',
      owner: 'Design team',
    },
    {
      id: 'track-prehealth',
      name: 'Pre-health readiness',
      readiness: 74,
      focus: 'Organic chemistry lab write-up and clinical volunteering hours need attention.',
      owner: 'Pre-professional advising',
    },
    {
      id: 'track-research',
      name: 'Undergraduate research portfolio',
      readiness: 68,
      focus: 'Lab outreach drafts are ready; methods experience needs clearer evidence.',
      owner: 'Research mentor',
    },
  ],
  opportunityMatches: [
    {
      id: 'match-imaging',
      title: 'Computational imaging research assistant',
      lab: 'Whiting School biomedical imaging group',
      match: 91,
      detail: 'Strong fit for Python, signal processing, and medical imaging interests.',
      nextStep: 'Draft outreach email',
    },
    {
      id: 'match-public-health',
      title: 'Health outcomes data fellow',
      lab: 'Bloomberg School population health analytics',
      match: 86,
      detail: 'Connects biostatistics coursework with clinical equity interests.',
      nextStep: 'Prepare resume bullets',
    },
    {
      id: 'match-neuro',
      title: 'Neuroengineering lab rotation',
      lab: 'Homewood neuroengineering group',
      match: 79,
      detail: 'Good topic fit, but schedule conflicts with organic chemistry lab.',
      nextStep: 'Check office hours',
    },
  ],
  weeklyPlan: [
    {
      id: 'plan-design',
      title: 'Tighten BME design validation plan',
      detail: 'Add clinical stakeholder assumptions and one measurable validation endpoint.',
      complete: false,
    },
    {
      id: 'plan-orgo',
      title: 'Finish organic chemistry lab write-up',
      detail: 'Complete spectroscopy interpretation before Wednesday evening.',
      complete: true,
    },
    {
      id: 'plan-research',
      title: 'Send two lab outreach emails',
      detail: 'Use the research match notes to tailor each email to the lab agenda.',
      complete: false,
    },
  ],
  deadlines: [
    {
      id: 'deadline-midterm',
      dateLabel: 'Thursday',
      title: 'Biostatistics midterm',
      detail: 'Regression diagnostics and confidence intervals are the weakest topics.',
    },
    {
      id: 'deadline-design',
      dateLabel: 'Friday',
      title: 'BME design review',
      detail: 'Prototype validation plan due before mentor review.',
    },
  ],
}

export const JOHNS_HOPKINS_PROFESSOR_OVERVIEW: ProfessorOverview = {
  professorName: 'Prof. Elena Rodriguez',
  school: 'Johns Hopkins University',
  metrics: [
    {
      id: 'students',
      label: 'Advisees flagged',
      value: '12',
      detail: 'Course, research, and fellowship signals requiring review',
    },
    {
      id: 'grant',
      label: 'Grant readiness',
      value: '71%',
      detail: 'Specific aims are strong; biosketch and data sharing plan need work',
    },
    {
      id: 'course',
      label: 'Course alerts',
      value: '8',
      detail: 'BME design teams with repeated milestone slippage',
    },
  ],
  researchPipeline: [
    {
      id: 'pipeline-r01',
      name: 'NIH R01 resubmission',
      readiness: 71,
      focus: 'Reviewer response matrix is drafted; innovation section needs stronger framing.',
      owner: 'PI office',
    },
    {
      id: 'pipeline-lab',
      name: 'Undergraduate research onboarding',
      readiness: 64,
      focus: 'Four students match the lab agenda; training modules and mentor capacity need balancing.',
      owner: 'Lab manager',
    },
    {
      id: 'pipeline-course',
      name: 'BME design course outcomes',
      readiness: 78,
      focus: 'Most teams are on pace, but clinical validation plans need earlier intervention.',
      owner: 'Teaching team',
    },
  ],
  grantSections: [
    {
      id: 'aims',
      label: 'Specific aims',
      max: 5,
      descriptor: 'Clarity, hypothesis, significance, and reviewer-facing logic.',
    },
    {
      id: 'innovation',
      label: 'Innovation',
      max: 5,
      descriptor: 'Novel contribution beyond current biomedical engineering methods.',
    },
    {
      id: 'approach',
      label: 'Approach',
      max: 5,
      descriptor: 'Study design, feasibility, risk mitigation, and milestones.',
    },
    {
      id: 'impact',
      label: 'Impact',
      max: 5,
      descriptor: 'Clinical relevance, translational path, and measurable outcomes.',
    },
  ],
  advisingQueue: [
    {
      id: 'advise-maya',
      student: 'Maya Chen',
      program: 'BME junior',
      signal: 'Strong research fit, but midterm and lab write-up collide with outreach deadlines.',
      recommendation: 'Approve two lab emails after design review draft is submitted.',
    },
    {
      id: 'advise-omar',
      student: 'Omar Patel',
      program: 'MS Applied Biomedical Engineering',
      signal: 'Capstone sponsor feedback is positive; documentation trail is incomplete.',
      recommendation: 'Require prototype test log before next sponsor meeting.',
    },
    {
      id: 'advise-nadia',
      student: 'Nadia Williams',
      program: 'PhD rotation',
      signal: 'Rotation goals are clear; IRB training is blocking data access.',
      recommendation: 'Escalate CITI completion and pair with senior doctoral mentor.',
    },
  ],
  courseSignals: [
    {
      id: 'course-team-2',
      title: 'Design Team 2 validation gap',
      detail: 'No measurable clinical endpoint in the latest prototype review.',
      severity: 'High',
    },
    {
      id: 'course-team-7',
      title: 'Design Team 7 sponsor response',
      detail: 'Sponsor feedback has not been converted into requirements.',
      severity: 'Medium',
    },
    {
      id: 'course-office-hours',
      title: 'Office hours demand spike',
      detail: 'Requests cluster around regression interpretation and design validation.',
      severity: 'Medium',
    },
  ],
}

export const JOHNS_HOPKINS_ADMIN_OVERVIEW: AdminOverview = {
  adminName: 'Daniel Brooks',
  school: 'Johns Hopkins University',
  metrics: [
    {
      id: 'learners',
      label: 'Students in pilot',
      value: '1.2k',
      detail: 'Homewood, BME, public health, and pre-professional advising cohorts',
    },
    {
      id: 'adoption',
      label: 'Faculty adoption',
      value: '63%',
      detail: 'Weekly active use across advising, course, and research workflows',
    },
    {
      id: 'risks',
      label: 'Open risk flags',
      value: '24',
      detail: 'Student success, research compliance, and grant operations',
    },
    {
      id: 'departments',
      label: 'Units tracked',
      value: '6',
      detail: 'Academic departments and advising offices in the university pilot',
    },
  ],
  operatingTracks: [
    {
      id: 'track-success',
      name: 'Student success intervention loop',
      readiness: 74,
      focus: 'Academic alerts, advising notes, and tutoring referrals need one workflow owner.',
      owner: 'Student success office',
    },
    {
      id: 'track-research',
      name: 'Research compliance operations',
      readiness: 69,
      focus: 'IRB/CITI status, data-use agreements, and lab onboarding are not yet unified.',
      owner: 'Research administration',
    },
    {
      id: 'track-faculty',
      name: 'Faculty workload and grant support',
      readiness: 81,
      focus: 'Grant timelines and course signals are ready for department chair review.',
      owner: 'Academic operations',
    },
  ],
  complianceWork: [
    {
      id: 'compliance-ferpa',
      label: 'FERPA-safe advising summaries',
      detail: 'Student success summaries exclude raw faculty notes and sensitive health details.',
      owner: 'Registrar',
      complete: true,
    },
    {
      id: 'compliance-irb',
      label: 'IRB and CITI training visibility',
      detail: 'Research dashboards need a single training-completion status per student.',
      owner: 'Research compliance',
      complete: false,
    },
    {
      id: 'compliance-grants',
      label: 'Grant deadline governance',
      detail: 'Proposal milestones should trigger department and central admin reminders.',
      owner: 'Sponsored projects',
      complete: false,
    },
  ],
  studentSuccessRisks: [
    {
      id: 'risk-midterm',
      segment: 'Pre-health undergraduates',
      signal: 'Midterm clusters overlap with lab deliverables for 38 students.',
      action: 'Open supplemental instruction slots',
      severity: 'High',
    },
    {
      id: 'risk-research',
      segment: 'First-time research assistants',
      signal: 'Training requirements are incomplete for 17 lab placements.',
      action: 'Send onboarding escalation',
      severity: 'Medium',
    },
    {
      id: 'risk-finaid',
      segment: 'High workload plus aid hold',
      signal: 'Seven students show advising flags and unresolved account holds.',
      action: 'Route to SEAM support',
      severity: 'High',
    },
  ],
}
