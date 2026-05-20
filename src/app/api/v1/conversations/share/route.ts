import type { NextRequest } from 'next/server'
import { handleBffRoute, type BffDomainService } from '../../_utils/bff'
import * as domainService from '@/server/app-api/v1/conversations/share/route'

export async function PATCH(request: NextRequest) {
  return handleBffRoute(request, {}, domainService.PATCH as BffDomainService)
}
