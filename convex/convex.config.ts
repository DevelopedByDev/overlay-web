import { defineApp } from 'convex/server'
import stripe from '@convex-dev/stripe/convex.config.js'

const app = defineApp()
app.use(stripe)

export default app
