/**
 * System-prompt text for models: the chat UI uses remark-math + KaTeX. Inline math
 * should use `$...$`; display math should use standalone `$$` fences.
 */
export const MATH_FORMAT_INSTRUCTION = [
  'Formatting requirements for mathematical notation:',
  '- Use standard Markdown math only: inline math as $...$ and display equations as standalone $$ blocks.',
  '- For display math, put the opening $$ and closing $$ on their own lines.',
  '- Do not use $$...$$ inline inside a sentence; use $...$ for short expressions like $O(n^2)$ or $\\Sigma$.',
  '- Forbidden: wrapping math in square brackets [ ... ] or only in parentheses ( ... ); bare \\[...\\] or \\(...\\); or leaving TeX commands (e.g. \\frac, \\sum, \\Re) undelimited in prose.',
  '- Keep normal explanatory sentences outside math delimiters.',
].join('\n')
