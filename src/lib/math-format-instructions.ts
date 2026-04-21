/**
 * System-prompt text for models: the chat UI uses remark-math + KaTeX and only reliably
 * parses math inside `$$...$$` (see MarkdownMessage). Weak models often emit `[ ... ]` or
 * `\[...\]` around LaTeX, which do not render.
 */
export const MATH_FORMAT_INSTRUCTION = [
  'Formatting requirements for mathematical notation (strict — the UI only renders ONE math style):',
  '- Put every equation, formula, or LaTeX fragment inside double dollar delimiters only: $$...$$.',
  '- Use $$...$$ for both short “inline” math and longer display math in this UI.',
  '- Forbidden (will NOT render correctly): wrapping math in square brackets [ ... ] or only in parentheses ( ... ); bare \\[...\\], \\(...\\), or single $...$; or leaving TeX commands (e.g. \\frac, \\sum, \\Re) undelimited in prose.',
  '- Do not use [ ] or ( ) as substitute delimiters for LaTeX — only $$...$$ is rendered.',
  '- Keep normal explanatory sentences outside the $$ spans.',
].join('\n')
