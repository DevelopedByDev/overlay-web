import { convex } from "@/lib/convex";
import type {
  AppCreateSkillInput,
  AppCreateSkillResult,
  AppDeleteSkillResult,
  AppSkillListFilters,
  AppSkillSummary,
  AppUpdateSkillInput,
  AppUpdateSkillResult,
} from "@/lib/app-api/skill-contract";

export async function listAppSkills(
  userId: string,
  serverSecret: string,
  filters: AppSkillListFilters = {},
): Promise<AppSkillSummary[]> {
  return (
    (await convex.query<AppSkillSummary[]>("skills:list", {
      userId,
      serverSecret,
      ...(filters.projectId !== undefined ? { projectId: filters.projectId } : {}),
    })) || []
  );
}

export async function getAppSkill(
  userId: string,
  serverSecret: string,
  skillId: string,
): Promise<AppSkillSummary | null> {
  return await convex.query<AppSkillSummary | null>("skills:get", {
    skillId,
    userId,
    serverSecret,
  });
}

export async function createAppSkill(
  input: AppCreateSkillInput,
): Promise<AppCreateSkillResult> {
  const skillId = await convex.mutation<string>("skills:create", {
    userId: input.userId,
    serverSecret: input.serverSecret,
    name: input.name,
    description: input.description || "",
    instructions: input.instructions || "",
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    projectId: input.projectId ?? undefined,
  });

  return { id: skillId };
}

export async function updateAppSkill(
  input: AppUpdateSkillInput,
): Promise<AppUpdateSkillResult> {
  await convex.mutation("skills:update", {
    skillId: input.skillId,
    userId: input.userId,
    serverSecret: input.serverSecret,
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    enabled: input.enabled,
  });
  return { success: true };
}

export async function deleteAppSkill(
  userId: string,
  serverSecret: string,
  skillId: string,
): Promise<AppDeleteSkillResult> {
  await convex.mutation("skills:remove", {
    skillId,
    userId,
    serverSecret,
  });
  return { success: true };
}
