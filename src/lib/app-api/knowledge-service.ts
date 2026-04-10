import { convex } from "@/lib/convex";
import type {
  AppKnowledgeSearchInput,
  AppKnowledgeSearchResult,
} from "@/lib/app-api/knowledge-contract";

export async function searchAppKnowledge(
  input: AppKnowledgeSearchInput,
): Promise<AppKnowledgeSearchResult | null> {
  return await convex.action<AppKnowledgeSearchResult>(
    "knowledge:hybridSearch",
    {
      accessToken: input.accessToken,
      userId: input.userId,
      serverSecret: input.serverSecret,
      query: input.query,
      projectId: input.projectId,
      sourceKind: input.sourceKind,
      kVec: input.kVec,
      kLex: input.kLex,
      m: input.m,
    },
  );
}
