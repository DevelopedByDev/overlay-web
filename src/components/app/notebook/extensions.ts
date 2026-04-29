import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Mathematics from '@tiptap/extension-mathematics'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import Youtube from '@tiptap/extension-youtube'
import Emoji from '@tiptap/extension-emoji'
import UniqueID from '@tiptap/extension-unique-id'
import FileHandler from '@tiptap/extension-file-handler'
import { common, createLowlight } from 'lowlight'

const lowlight = createLowlight(common)

async function uploadImage(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Image read failed'))
    reader.readAsDataURL(file)
  })
}

export function createNotebookExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
    }),
    Placeholder.configure({
      placeholder: 'Start writing... (type / for commands)',
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
      includeChildren: true,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'plaintext',
    }),
    Mathematics.configure({
      katexOptions: { throwOnError: false },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Typography,
    Subscript,
    Superscript,
    Highlight.configure({ multicolor: true }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      protocols: ['http', 'https', 'mailto'],
    }),
    TextStyle,
    Youtube.configure({
      controls: true,
      nocookie: true,
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    Emoji.configure({ enableEmoticons: true }),
    UniqueID.configure({
      types: ['heading', 'paragraph', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'table'],
    }),
    FileHandler.configure({
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      onDrop: (editor, files, pos) => {
        files.forEach((file) => {
          void uploadImage(file).then((src) => {
            editor.chain().insertContentAt(pos, { type: 'image', attrs: { src } }).focus().run()
          }).catch(() => {})
        })
      },
      onPaste: (editor, files) => {
        files.forEach((file) => {
          void uploadImage(file).then((src) => {
            editor.chain().focus().setImage({ src }).run()
          }).catch(() => {})
        })
      },
    }),
  ]
}
