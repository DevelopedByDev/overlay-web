function entityPart(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9_-]/g, '_')
}

export function projectComposioEntityId(userId: string, projectId: string): string {
  return `overlay_project_${entityPart(userId)}_${entityPart(projectId)}`
}
