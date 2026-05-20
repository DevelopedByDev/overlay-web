import type { NextRequest } from 'next/server'
import { handleBffRoute, type BffDomainService } from '../../_utils/bff'
import * as domainService from '@/server/app-api/v1/files/ingest-document/route'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  return handleBffRoute(request, {}, domainService.POST as BffDomainService)
}
