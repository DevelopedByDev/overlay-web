// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Job queue layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export interface IQueue {
  enqueue(job: JobSpec): Promise<string>
  schedule(job: JobSpec, runAt: Date): Promise<string>
  cancel(jobId: string): Promise<void>
  getStatus(jobId: string): Promise<JobStatus>
  listJobs(userId: string, opts?: ListJobsOptions): Promise<Job[]>
}

export interface JobSpec {
  type: string
  payload: Record<string, unknown>
  userId: string
  priority?: number
  maxRetries?: number
}

export interface Job {
  id: string
  type: string
  payload: Record<string, unknown>
  userId: string
  status: JobStatus
  scheduledAt?: number
  startedAt?: number
  completedAt?: number
  errorMessage?: string
  retryCount: number
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ListJobsOptions {
  limit?: number
  status?: JobStatus
  type?: string
}
