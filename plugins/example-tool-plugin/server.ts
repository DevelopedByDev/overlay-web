// @enterprise-future — not wired to production
// Example tool plugin entrypoint (server-side)

import { defineTool } from '@overlay/plugin-sdk/server'
import { z } from 'zod'

export default defineTool({
  id: 'example.greet',
  name: 'Greet',
  description: 'Returns a personalized greeting message',
  parameters: z.object({
    name: z.string().describe('Name of the person to greet'),
  }),
  async execute(args, context) {
    const { name } = args as { name: string }
    const defaultGreeting = (context.config.defaultGreeting as string) || 'Hello'
    return { greeting: `${defaultGreeting}, ${name}!` }
  },
})
