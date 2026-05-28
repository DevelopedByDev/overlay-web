import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { automationErrorResponse, automationService } from '@/server/automations/http'

export async function GET(request: NextRequest, context: AppApiRouteContext) {
  try {
    const { auth } = context
    const automationId = request.nextUrl.searchParams.get('automationId')
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined
    const includeDeleted = request.nextUrl.searchParams.get('includeDeleted') === 'true'
    const includeRuns = request.nextUrl.searchParams.get('runs') === 'true'
    const result = await automationService.getAutomations({
      userId: auth.userId,
      automationId,
      projectId,
      includeDeleted,
      includeRuns,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.name === 'AutomationServiceError') {
      return automationErrorResponse(error, 'Failed to fetch automations')
    }
    console.error('[automations GET]', error)
    return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: AppApiRouteContext) {
  try {
    const body = await request.json()
    const { auth } = context
    const result = await automationService.createAutomation({
      userId: auth.userId,
      body,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AutomationServiceError')) {
      console.error('[automations POST]', error)
    }
    return automationErrorResponse(error, 'Failed to create automation')
  }
}

export async function PATCH(request: NextRequest, context: AppApiRouteContext) {
  try {
    const body = await request.json()
    const { auth } = context
    const result = await automationService.updateAutomation({
      userId: auth.userId,
      body,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AutomationServiceError')) {
      console.error('[automations PATCH]', error)
    }
    return automationErrorResponse(error, 'Failed to update automation')
  }
}

export async function DELETE(request: NextRequest, context: AppApiRouteContext) {
  try {
    let body: { accessToken?: string; userId?: string; automationId?: string } = {}
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      body = await request.json().catch(() => ({}))
    }
    const { auth } = context
    const result = await automationService.deleteAutomation({
      automationId: body.automationId || request.nextUrl.searchParams.get('automationId'),
      userId: auth.userId,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AutomationServiceError')) {
      console.error('[automations DELETE]', error)
    }
    return automationErrorResponse(error, 'Failed to delete automation')
  }
}
