'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  LineChart,
  Target,
} from 'lucide-react'
import {
  AppScreenBody,
  AppScreenHeader,
  AppScreenShell,
} from '@overlay/modules-react/shell'
import type { OverlayExtensionComponentProps } from '../registry'
import {
  ActionButton,
  HeaderIdentity,
  MetricCard,
  Panel,
  ProgressBar,
  Row,
  StatusPill,
} from './JpisDashboardPrimitives'
import {
  JPIS_STUDENT_OVERVIEW,
  type StudentOverview,
} from './data'

const metricIcons: Record<string, LucideIcon> = {
  tasks: ClipboardCheck,
  practice: BookOpenCheck,
  readiness: LineChart,
}

function readinessTone(value: number) {
  if (value >= 78) return 'success'
  if (value >= 62) return 'warning'
  return 'danger'
}

export function JpisStudentDashboard({
  featureModule,
}: OverlayExtensionComponentProps) {
  const [overview, setOverview] = useState<StudentOverview>(JPIS_STUDENT_OVERVIEW)
  const [selectedQuizId, setSelectedQuizId] = useState(JPIS_STUDENT_OVERVIEW.quizzes[0]?.id ?? '')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let active = true
    void fetch('/api/v1/extensions/jpis-school/student/overview', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: StudentOverview | null) => {
        if (active && data) setOverview(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const metrics = useMemo(() => overview.metrics, [overview])
  const selectedQuiz = useMemo(
    () => overview.quizzes.find((quiz) => quiz.id === selectedQuizId) ?? overview.quizzes[0],
    [overview.quizzes, selectedQuizId],
  )
  const quizScore = useMemo(() => {
    if (!selectedQuiz) return 0
    return selectedQuiz.questions.filter((question) => answers[question.id] === question.answerIndex).length
  }, [answers, selectedQuiz])

  function selectQuiz(quizId: string) {
    setSelectedQuizId(quizId)
    setAnswers({})
    setSubmitted(false)
  }

  return (
    <AppScreenShell
      header={
        <AppScreenHeader
          title={featureModule?.label ?? 'Student'}
          actions={<HeaderIdentity name={overview.studentName} />}
        />
      }
    >
      <AppScreenBody padding="md" maxWidth="xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.id}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
                icon={metricIcons[metric.id] ?? LineChart}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-4">
              <Panel
                title={`${overview.studentName} learning tracks`}
                description="IB readiness with teacher-approved next steps."
                icon={LineChart}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.learningTracks.map((item) => (
                    <div key={item.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <StatusPill tone="neutral">{item.curriculum}</StatusPill>
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.subject}</p>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{item.detail}</p>
                        </div>
                        <StatusPill tone={readinessTone(item.readiness)}>{item.status}</StatusPill>
                      </div>
                      <div className="mt-3">
                        <ProgressBar value={item.readiness} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="IB Physics quiz practice"
                description="Paper 1 style checks with immediate scoring and strand explanations."
                icon={BookOpenCheck}
              >
                <div className="space-y-4 p-4">
                  <div className="flex flex-wrap gap-2">
                    {overview.quizzes.map((quiz) => (
                      <button
                        key={quiz.id}
                        type="button"
                        onClick={() => selectQuiz(quiz.id)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedQuiz?.id === quiz.id
                            ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                            : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] hover:bg-[var(--border)]'
                        }`}
                      >
                        {quiz.title}
                      </button>
                    ))}
                  </div>

                  {selectedQuiz ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--foreground)]">{selectedQuiz.paper}</p>
                            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{selectedQuiz.objective}</p>
                          </div>
                          <StatusPill tone="neutral">{selectedQuiz.timeLimit}</StatusPill>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {selectedQuiz.questions.map((question, questionIndex) => {
                          const selectedAnswer = answers[question.id]
                          const answeredCorrectly = selectedAnswer === question.answerIndex
                          return (
                            <div key={question.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs text-[var(--muted)]">Question {questionIndex + 1} · {question.strand}</p>
                                  <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--foreground)]">{question.prompt}</p>
                                </div>
                                {submitted ? (
                                  <StatusPill tone={answeredCorrectly ? 'success' : 'danger'}>
                                    {answeredCorrectly ? 'Correct' : 'Review'}
                                  </StatusPill>
                                ) : null}
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {question.options.map((option, optionIndex) => {
                                  const selected = selectedAnswer === optionIndex
                                  const correct = question.answerIndex === optionIndex
                                  return (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => {
                                        setAnswers((current) => ({ ...current, [question.id]: optionIndex }))
                                        setSubmitted(false)
                                      }}
                                      className={`min-h-10 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                                        submitted && correct
                                          ? 'border-emerald-500/30 bg-emerald-500/10 text-[var(--foreground)]'
                                          : selected
                                            ? 'border-[var(--foreground)] bg-[var(--surface-subtle)] text-[var(--foreground)]'
                                            : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
                                      }`}
                                    >
                                      {option}
                                    </button>
                                  )
                                })}
                              </div>
                              {submitted ? (
                                <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{question.explanation}</p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-[var(--muted)]">
                          {submitted
                            ? `Score: ${quizScore}/${selectedQuiz.questions.length}`
                            : `${Object.keys(answers).length}/${selectedQuiz.questions.length} answered`}
                        </p>
                        <div className="flex gap-2">
                          <ActionButton
                            disabled={Object.keys(answers).length === 0}
                            onClick={() => {
                              setAnswers({})
                              setSubmitted(false)
                            }}
                          >
                            Reset
                          </ActionButton>
                          <ActionButton
                            disabled={Object.keys(answers).length !== selectedQuiz.questions.length}
                            onClick={() => setSubmitted(true)}
                          >
                            Grade quiz
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel
                title="Upcoming"
                description="Near-term academic checkpoints."
                icon={CalendarDays}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.upcoming.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      meta={<StatusPill>{item.dateLabel}</StatusPill>}
                    />
                  ))}
                </div>
              </Panel>

              <Panel
                title="Focus queue"
                description="Student-owned tasks that can be completed before the next check-in."
                icon={Target}
              >
                <div className="divide-y divide-[var(--border)]">
                  {overview.focusQueue.map((item) => (
                    <Row
                      key={item.id}
                      title={item.title}
                      detail={item.detail}
                      action={<ActionButton>{item.action}</ActionButton>}
                    />
                  ))}
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </AppScreenBody>
    </AppScreenShell>
  )
}
