'use client'

import type { ComponentProps } from 'react'
import KnowledgeView from '@/features/knowledge/components/KnowledgeView'
import { FileViewer } from '@/features/files/components/FileViewer'

type KnowledgeViewProps = ComponentProps<typeof KnowledgeView>

export default function KnowledgeViewHost(props: Omit<KnowledgeViewProps, 'renderFileViewer'>) {
  return (
    <KnowledgeView
      {...props}
      renderFileViewer={({ name, content, url }) => (
        <FileViewer name={name} content={content} url={url} />
      )}
    />
  )
}
