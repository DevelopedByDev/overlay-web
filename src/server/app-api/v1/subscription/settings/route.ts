import { NextRequest } from 'next/server'
import { GET as getBillingSettings, POST as updateBillingSettings } from '@/app/api/subscription/settings/route'

export async function GET(request: NextRequest) {
  return getBillingSettings(request)
}

export async function POST(request: NextRequest) {
  return updateBillingSettings(request)
}
