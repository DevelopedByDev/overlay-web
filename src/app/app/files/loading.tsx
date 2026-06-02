import { Suspense } from 'react'
import { FilesRouteSkeleton } from '../_components/AppRouteSkeletons'
import { FilesRouteLoadingSkeleton } from './FilesRouteLoadingSkeleton'

export default function Loading() {
  return (
    <Suspense fallback={<FilesRouteSkeleton />}>
      <FilesRouteLoadingSkeleton />
    </Suspense>
  )
}
