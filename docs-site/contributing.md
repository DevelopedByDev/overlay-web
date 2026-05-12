---
title: Contributing
description: Development workflow for Overlay Enterprise.
---

## Workflow

Fork the repository, create a branch from `enterprise`, and keep changes scoped to the feature or fix you are proposing.

## Local Setup

Install dependencies, configure `.env.local`, and run the web app with the matching Convex deployment. For Convex schema or function changes, push both deployments with `npm run convex:push:all`.

## Route Schemas

Every API route must import `z` from `src/lib/api-schemas`, declare a `RequestSchema` and `ResponseSchema`, and attach `.openapi('Name')` metadata. Run the phase verifier for the route group you touched.

## UI Components

Shared UI belongs in `packages/overlay-ui`. Add or update a Storybook story when a primitive, layout, chat component, or theming API changes.

## Core Interfaces

Provider contracts belong in `packages/overlay-core`. Public interfaces should be exported from `src/index.ts` so TypeDoc can include them.
