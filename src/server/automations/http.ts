import 'server-only'

import { NextResponse } from 'next/server'
import { AutomationService, AutomationServiceError } from './AutomationService'
import { ConvexAutomationRepository } from './ConvexAutomationRepository'

export const automationService = new AutomationService({
  repository: new ConvexAutomationRepository(),
})

export function automationErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AutomationServiceError) {
    return NextResponse.json(error.payload, { status: error.statusCode })
  }
  return NextResponse.json({ error: fallback }, { status: 500 })
}
