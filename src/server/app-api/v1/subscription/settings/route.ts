import { NextRequest } from 'next/server'
import { GET as getBillingSettings, POST as updateBillingSettings } from '@/app/api/subscription/settings/route'
import { validateApiBoundary } from '../../_utils/boundary'

export async function GET(request: NextRequest) {
  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError
  return getBillingSettings(request)
}

export async function POST(request: NextRequest) {
  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError
  return updateBillingSettings(request)
}
