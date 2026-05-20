import type { NextRequest } from 'next/server'
import { handleBffRoute, type BffDomainService } from '../_utils/bff'
import * as domainService from '@/server/app-api/v1/generate-image/route'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  return handleBffRoute(request, {}, domainService.POST as BffDomainService)
}
