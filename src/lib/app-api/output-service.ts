import { convex } from "@/lib/convex";
import { deleteObject } from "@/lib/r2";
import type {
  AppDeleteOutputResult,
  AppOutputListFilters,
  AppOutputProxyTarget,
  AppOutputSummary,
} from "@/lib/app-api/output-contract";

export async function listAppOutputs(
  userId: string,
  serverSecret: string,
  filters: AppOutputListFilters = {},
): Promise<AppOutputSummary[]> {
  if (filters.conversationId) {
    return (
      (await convex.query<AppOutputSummary[]>(
        "outputs:listByConversationId",
        {
          conversationId: filters.conversationId,
          userId,
          serverSecret,
        },
        { throwOnError: true },
      )) || []
    );
  }

  return (
    (await convex.query<AppOutputSummary[]>(
      "outputs:list",
      {
        userId,
        serverSecret,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      },
      { throwOnError: true },
    )) || []
  );
}

export async function getAppOutput(
  userId: string,
  serverSecret: string,
  outputId: string,
): Promise<AppOutputSummary | null> {
  return await convex.query<AppOutputSummary | null>(
    "outputs:get",
    {
      outputId,
      userId,
      serverSecret,
    },
    { throwOnError: true },
  );
}

export async function deleteAppOutput(
  userId: string,
  serverSecret: string,
  outputId: string,
): Promise<AppDeleteOutputResult> {
  const output = await getAppOutput(userId, serverSecret, outputId);
  if (output?.r2Key) {
    await deleteObject(output.r2Key);
    console.log(
      `[OutputsDelete] Deleted R2 object key=${output.r2Key} for outputId=${outputId}`,
    );
  }

  await convex.mutation(
    "outputs:remove",
    {
      outputId,
      userId,
      serverSecret,
    },
    { throwOnError: true },
  );

  return { success: true };
}

export async function getAppOutputProxyTarget(
  userId: string,
  serverSecret: string,
  outputId: string,
): Promise<AppOutputProxyTarget | null> {
  return await convex.query<AppOutputProxyTarget | null>(
    "outputs:getStorageUrlForProxy",
    {
      outputId,
      userId,
      serverSecret,
    },
    { throwOnError: true },
  );
}
