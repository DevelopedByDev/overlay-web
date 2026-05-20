import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-async-light'
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark'
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light'

export default function LazySyntaxHighlighter({
  children,
  isDark,
  language,
}: {
  children: string | string[]
  isDark: boolean
  language: string
}) {
  return (
    <SyntaxHighlighter
      style={isDark ? oneDark : oneLight}
      language={language}
      PreTag="div"
      customStyle={{
        margin: 0,
        borderRadius: '0 0 10px 10px',
        background: isDark ? 'transparent' : '#f8f8f8',
        fontSize: '0.85rem',
        lineHeight: '1.6',
      }}
      codeTagProps={{
        style: { fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace" },
      }}
    >
      {children}
    </SyntaxHighlighter>
  )
}
