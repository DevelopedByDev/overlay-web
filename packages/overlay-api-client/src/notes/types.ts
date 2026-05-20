import type { NoteQueryContract } from '@overlay/app-core'
import type { FileQuery } from '../files/types'

export interface NoteQuery extends NoteQueryContract {}

export type NoteFileQuery = Omit<FileQuery, 'kind'>
