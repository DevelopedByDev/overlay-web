import type { Preview } from '@storybook/react'
import React from 'react'
import { ThemeProvider } from '../src/theming/ThemeProvider'

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="light">
        <div style={{ minHeight: 320, padding: 24, background: 'var(--background)', color: 'var(--foreground)' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
}

export default preview
