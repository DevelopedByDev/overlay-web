import { convex } from "@/lib/convex";
import type {
  AppCreateProjectInput,
  AppCreateProjectResult,
  AppDeleteProjectResult,
  AppProjectListFilters,
  AppProjectSummary,
  AppUpdateProjectInput,
  AppUpdateProjectResult,
} from "@/lib/app-api/project-contract";
import type { Id } from "../../../convex/_generated/dataModel";

function collectDescendants(
  projects: Array<{ _id: string; parentId?: string }>,
  rootId: string,
): string[] {
  const result: string[] = [rootId];
  const children = projects.filter((p) => p.parentId === rootId);
  for (const child of children) {
    result.push(...collectDescendants(projects, child._id));
  }
  return result;
}

export async function listAppProjects(
  userId: string,
  serverSecret: string,
  filters: AppProjectListFilters = {},
): Promise<AppProjectSummary[]> {
  return (
    (await convex.query<AppProjectSummary[]>("projects:list", {
      userId,
      serverSecret,
      ...(filters.updatedSince !== undefined
        ? { updatedSince: filters.updatedSince }
        : {}),
      ...(filters.includeDeleted !== undefined
        ? { includeDeleted: filters.includeDeleted }
        : {}),
    })) || []
  );
}

export async function getAppProject(
  userId: string,
  serverSecret: string,
  projectId: string,
): Promise<AppProjectSummary | null> {
  return await convex.query<AppProjectSummary | null>("projects:get", {
    projectId: projectId as Id<"projects">,
    userId,
    serverSecret,
  });
}

export async function createAppProject(
  input: AppCreateProjectInput,
): Promise<AppCreateProjectResult> {
  const id = await convex.mutation<Id<"projects">>("projects:create", {
    userId: input.userId,
    serverSecret: input.serverSecret,
    clientId: input.clientId?.trim() || undefined,
    name: input.name,
    instructions: input.instructions?.trim() || undefined,
    parentId: input.parentId ?? undefined,
  });
  if (!id) {
    throw new Error("Failed to create project");
  }

  return {
    id,
    project: await getAppProject(input.userId, input.serverSecret, id),
  };
}

export async function updateAppProject(
  input: AppUpdateProjectInput,
): Promise<AppUpdateProjectResult> {
  await convex.mutation("projects:update", {
    projectId: input.projectId as Id<"projects">,
    userId: input.userId,
    serverSecret: input.serverSecret,
    name: input.name,
    instructions: input.instructions,
    parentId: input.parentId ?? undefined,
  });

  return {
    success: true,
    project: await getAppProject(
      input.userId,
      input.serverSecret,
      input.projectId,
    ),
  };
}

export async function deleteAppProject(
  userId: string,
  serverSecret: string,
  projectId: string,
): Promise<AppDeleteProjectResult> {
  const allProjects =
    (await convex.query<
      Array<{ _id: string; parentId?: string; deletedAt?: number }>
    >("projects:list", {
      userId,
      serverSecret,
      includeDeleted: true,
    })) || [];

  const toDelete = collectDescendants(allProjects, projectId);
  for (const id of toDelete.reverse()) {
    await convex.mutation("projects:remove", {
      projectId: id as Id<"projects">,
      userId,
      serverSecret,
    });
  }

  return {
    success: true,
    deletedIds: toDelete,
    deletedAt: Date.now(),
  };
}
