import type { NextRequest } from 'next/server'
import { handleBffRoute, type BffDomainService } from '../_utils/bff'
import * as domainService from '@/server/app-api/v1/generate-video/route'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  return handleBffRoute(request, {}, domainService.POST as BffDomainService)
}
