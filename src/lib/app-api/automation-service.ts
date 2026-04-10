import { DEFAULT_MODEL_ID } from "@/lib/models";
import { convex } from "@/lib/convex";
import { getInternalApiBaseUrl } from "@/lib/url";
import { resolveAutomationExecutorMetadata } from "@/lib/automation-execution";
import {
  getNextAutomationRunAt,
  type AutomationOutputSummary,
  type AutomationRunEventSummary,
  type AutomationRunSummary,
  type AutomationSummary,
  type AutomationToolInvocationSummary,
} from "@/lib/automations";
import { runAutomationIntegrationPreflight } from "@/lib/automation-preflight";
import {
  buildAutomationRunPrompt,
  ensureAutomationConversation,
  executeAutomationTurn,
  loadAutomationSourceInstructions,
} from "@/lib/automation-runner";
import type {
  AppAutomationListFilters,
  AppAutomationRunDetail,
  AppAutomationRunSummary,
  AppAutomationRunsFilters,
  AppAutomationSummary,
  AppCreateAutomationInput,
  AppCreateAutomationResult,
  AppDeleteAutomationResult,
  AppRetryAutomationRunResult,
  AppRunAutomationNowResult,
  AppUpdateAutomationInput,
  AppUpdateAutomationResult,
} from "@/lib/app-api/automation-contract";
import type { NextRequest } from "next/server";
import type { Id } from "../../../convex/_generated/dataModel";

type ConversationMessage = {
  turnId: string;
  role: "user" | "assistant";
  content: string;
};

function normalizeScheduleConfig(
  scheduleKind: AppCreateAutomationInput["scheduleKind"],
  scheduleConfig?: AppCreateAutomationInput["scheduleConfig"],
) {
  const next = {
    onceAt: scheduleConfig?.onceAt,
    localTime: scheduleConfig?.localTime?.trim() || undefined,
    weekdays: scheduleConfig?.weekdays?.filter((value) =>
      Number.isInteger(value),
    ),
    dayOfMonth: scheduleConfig?.dayOfMonth,
  };

  if (scheduleKind === "weekdays") {
    next.weekdays = [1, 2, 3, 4, 5];
  }

  return next;
}

function deriveNextRunAt(
  scheduleKind: AppCreateAutomationInput["scheduleKind"],
  scheduleConfig: NonNullable<AppCreateAutomationInput["scheduleConfig"]>,
  timezone: string,
): number | undefined {
  return getNextAutomationRunAt({
    scheduleKind,
    scheduleConfig,
    timezone,
    afterTimestamp: Date.now(),
  });
}

export async function listAppAutomations(
  userId: string,
  serverSecret: string,
  filters: AppAutomationListFilters = {},
): Promise<AppAutomationSummary[]> {
  return (
    (await convex.query<AppAutomationSummary[]>("automations:list", {
      userId,
      serverSecret,
      ...(filters.projectId !== undefined ? { projectId: filters.projectId } : {}),
    })) || []
  );
}

export async function createAppAutomation(
  input: AppCreateAutomationInput,
): Promise<AppCreateAutomationResult> {
  const scheduleConfig = normalizeScheduleConfig(
    input.scheduleKind,
    input.scheduleConfig,
  );

  const automationId = await convex.mutation<Id<"automations">>(
    "automations:create",
    {
      userId: input.userId,
      serverSecret: input.serverSecret,
      projectId: input.projectId?.trim() || undefined,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      sourceType: input.sourceType,
      skillId: input.skillId as Id<"skills"> | undefined,
      instructionsMarkdown: input.instructionsMarkdown?.trim() || undefined,
      mode: input.mode,
      modelId: input.modelId?.trim() || DEFAULT_MODEL_ID,
      status: input.status ?? "active",
      timezone: input.timezone.trim(),
      scheduleKind: input.scheduleKind,
      scheduleConfig,
      nextRunAt: deriveNextRunAt(
        input.scheduleKind,
        scheduleConfig,
        input.timezone.trim(),
      ),
    },
    { throwOnError: true },
  );
  if (!automationId) {
    throw new Error("Failed to create automation");
  }

  return { id: automationId };
}

export async function updateAppAutomation(
  input: AppUpdateAutomationInput,
): Promise<AppUpdateAutomationResult> {
  const nextRunAt =
    input.scheduleKind && input.scheduleConfig && input.timezone?.trim()
      ? deriveNextRunAt(
          input.scheduleKind,
          normalizeScheduleConfig(input.scheduleKind, input.scheduleConfig),
          input.timezone.trim(),
        )
      : undefined;

  await convex.mutation(
    "automations:update",
    {
      automationId: input.automationId as Id<"automations">,
      userId: input.userId,
      serverSecret: input.serverSecret,
      projectId: input.projectId?.trim() || undefined,
      title: input.title,
      description: input.description,
      sourceType: input.sourceType,
      skillId: input.skillId as Id<"skills"> | undefined,
      instructionsMarkdown: input.instructionsMarkdown,
      mode: input.mode,
      modelId: input.modelId,
      status: input.status,
      timezone: input.timezone?.trim() || undefined,
      scheduleKind: input.scheduleKind,
      scheduleConfig: input.scheduleKind
        ? normalizeScheduleConfig(input.scheduleKind, input.scheduleConfig)
        : undefined,
      nextRunAt,
    },
    { throwOnError: true },
  );

  return { success: true };
}

export async function deleteAppAutomation(
  userId: string,
  serverSecret: string,
  automationId: string,
): Promise<AppDeleteAutomationResult> {
  await convex.mutation(
    "automations:remove",
    {
      automationId: automationId as Id<"automations">,
      userId,
      serverSecret,
    },
    { throwOnError: true },
  );
  return { success: true };
}

export async function listAppAutomationRuns(
  userId: string,
  serverSecret: string,
  automationId: string,
  filters: AppAutomationRunsFilters = {},
): Promise<AppAutomationRunSummary[]> {
  return (
    (await convex.query<AppAutomationRunSummary[]>(
      "automations:listRuns",
      {
        automationId: automationId as Id<"automations">,
        userId,
        serverSecret,
        limit: filters.limit,
      },
    )) || []
  );
}

export async function getAppAutomationRunDetail(
  userId: string,
  serverSecret: string,
  automationRunId: string,
): Promise<AppAutomationRunDetail | null> {
  const run = await convex.query<AutomationRunSummary | null>(
    "automations:getRun",
    {
      automationRunId: automationRunId as Id<"automationRuns">,
      userId,
      serverSecret,
    },
    { throwOnError: true },
  );
  if (!run) return null;

  const [automation, messages, outputs, tools, relatedRetryRun, events] =
    await Promise.all([
      convex.query<AutomationSummary | null>(
        "automations:get",
        {
          automationId: run.automationId as Id<"automations">,
          userId,
          serverSecret,
        },
        { throwOnError: true },
      ),
      run.conversationId
        ? convex.query<ConversationMessage[]>(
            "conversations:getMessages",
            {
              conversationId: run.conversationId as Id<"conversations">,
              userId,
              serverSecret,
            },
            { throwOnError: true },
          )
        : Promise.resolve([]),
      run.turnId
        ? convex.query<AutomationOutputSummary[]>("outputs:listByTurnId", {
            turnId: run.turnId,
            userId,
            serverSecret,
          }, { throwOnError: true })
        : Promise.resolve([]),
      run.turnId
        ? convex.query<AutomationToolInvocationSummary[]>("usage:listToolInvocations", {
            userId,
            serverSecret,
            turnId: run.turnId,
            limit: 50,
          }, { throwOnError: true })
        : Promise.resolve([]),
      convex.query<AutomationRunSummary | null>(
        "automations:findRetryRun",
        {
          automationId: run.automationId as Id<"automations">,
          automationRunId: run._id as Id<"automationRuns">,
          userId,
          serverSecret,
        },
        { throwOnError: true },
      ),
      convex.query<AutomationRunEventSummary[]>("automations:listRunEvents", {
        automationRunId: run._id as Id<"automationRuns">,
        userId,
        serverSecret,
        limit: 100,
      }, { throwOnError: true }),
    ]);

  const runMessages = run.turnId
    ? (messages ?? []).filter((message) => message.turnId === run.turnId)
    : [];
  const userMessage = runMessages.find((message) => message.role === "user")?.content;
  const assistantMessage =
    [...runMessages]
      .reverse()
      .find((message) => message.role === "assistant")?.content ||
    run.assistantMessage;

  return {
    run,
    automation: automation
      ? {
          _id: automation._id,
          title: automation.title,
          description: automation.description,
          mode: automation.mode,
          modelId: automation.modelId,
        }
      : undefined,
    userMessage,
    assistantMessage,
    outputs: outputs ?? [],
    tools: tools ?? [],
    relatedRetryRun: relatedRetryRun ?? undefined,
    events: events ?? [],
  };
}

export async function retryAppAutomationRun(
  userId: string,
  serverSecret: string,
  automationRunId: string,
): Promise<AppRetryAutomationRunResult | null> {
  const run = await convex.query<AutomationRunSummary | null>(
    "automations:getRun",
    {
      automationRunId: automationRunId as Id<"automationRuns">,
      userId,
      serverSecret,
    },
    { throwOnError: true },
  );
  if (!run) return null;
  if (run.status === "running" || run.status === "queued") {
    throw new Error("This run is already in progress or queued.");
  }

  const retryRunId = await convex.mutation<Id<"automationRuns"> | null>(
    "automations:queueRetryForRun",
    {
      automationRunId: automationRunId as Id<"automationRuns">,
      userId,
      serverSecret,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
    },
    { throwOnError: true },
  );

  if (!retryRunId) return null;
  return { success: true, automationRunId: retryRunId };
}

export async function runAppAutomationNow(input: {
  request: NextRequest;
  userId: string;
  serverSecret: string;
  automationId: string;
}): Promise<AppRunAutomationNowResult> {
  const startedAt = Date.now();
  const executor = resolveAutomationExecutorMetadata(input.request.headers);
  const automation = await convex.query<AutomationSummary | null>(
    "automations:get",
    {
      automationId: input.automationId as Id<"automations">,
      userId: input.userId,
      serverSecret: input.serverSecret,
    },
    { throwOnError: true },
  );

  if (!automation) {
    throw new Error("Automation not found");
  }

  const sourceInstructions = await loadAutomationSourceInstructions(
    automation,
    input.userId,
    input.serverSecret,
  );
  const prompt = buildAutomationRunPrompt(automation, sourceInstructions);
  const preflight = await runAutomationIntegrationPreflight({
    automation,
    sourceInstructions,
    userId: input.userId,
  });

  const scheduledFor = Date.now();
  const failedAt = Date.now();
  if (!preflight.ok) {
    const runId = await convex.mutation<Id<"automationRuns">>(
      "automations:createRun",
      {
        automationId: automation._id as Id<"automations">,
        userId: input.userId,
        serverSecret: input.serverSecret,
        status: "failed",
        stage: "needs_setup",
        triggerSource: "manual",
        scheduledFor,
        promptSnapshot: prompt,
        mode: automation.mode,
        modelId: automation.modelId,
      },
      { throwOnError: true },
    );
    if (!runId) {
      throw new Error("Failed to create automation run");
    }

    await convex.mutation("automations:updateRun", {
      automationRunId: runId,
      userId: input.userId,
      serverSecret: input.serverSecret,
      status: "failed",
      stage: "needs_setup",
      finishedAt: failedAt,
      durationMs: 0,
      readinessState:
        preflight.errorCode === "invalid_source"
          ? "invalid_source"
          : "needs_setup",
      failureStage: "preflight",
      errorCode: preflight.errorCode,
      errorMessage: preflight.errorMessage,
    }, { throwOnError: true });
    await convex.mutation("automations:update", {
      automationId: automation._id as Id<"automations">,
      userId: input.userId,
      serverSecret: input.serverSecret,
      readinessState:
        preflight.errorCode === "invalid_source"
          ? "invalid_source"
          : "needs_setup",
      readinessMessage: preflight.errorMessage,
    }, { throwOnError: true });
    await convex.mutation("automations:appendRunEvent", {
      automationRunId: runId,
      userId: input.userId,
      serverSecret: input.serverSecret,
      stage: "needs_setup",
      level: "error",
      message: "Manual automation run failed preflight.",
      metadata: {
        errorCode: preflight.errorCode,
        errorMessage: preflight.errorMessage,
      },
    }, { throwOnError: true });
    throw Object.assign(new Error(preflight.errorMessage), {
      statusCode: 409,
      automationRunId: runId,
    });
  }

  const conversationId = await ensureAutomationConversation({
    userId: input.userId,
    serverSecret: input.serverSecret,
    automation,
  });

  const runId = await convex.mutation<Id<"automationRuns">>(
    "automations:createRun",
    {
      automationId: automation._id as Id<"automations">,
      userId: input.userId,
      serverSecret: input.serverSecret,
      status: "running",
      stage: "running",
      triggerSource: "manual",
      scheduledFor,
      promptSnapshot: prompt,
      mode: automation.mode,
      modelId: automation.modelId,
      conversationId,
      startedAt,
      requestId: `manual-${automation._id}-${startedAt}`,
      lastHeartbeatAt: startedAt,
      executor,
      readinessState: "ready",
    },
    { throwOnError: true },
  );
  if (!runId) {
    throw new Error("Failed to create automation run");
  }

  await convex.mutation("automations:update", {
    automationId: automation._id as Id<"automations">,
    userId: input.userId,
    serverSecret: input.serverSecret,
    lastRunStatus: "running",
    readinessState: "ready",
    readinessMessage: undefined,
  }, { throwOnError: true });
  await convex.mutation("automations:appendRunEvent", {
    automationRunId: runId,
    userId: input.userId,
    serverSecret: input.serverSecret,
    stage: "running",
    level: "info",
    message: "Manual automation run started.",
    metadata: { executor },
  }, { throwOnError: true });

  const appendEvent = async (
    stage: "dispatching" | "running" | "persisting" | "succeeded" | "failed" | "needs_setup",
    level: "info" | "warning" | "error",
    message: string,
    metadata?: Record<string, unknown>,
  ) => {
    await convex.mutation("automations:appendRunEvent", {
      automationRunId: runId,
      userId: input.userId,
      serverSecret: input.serverSecret,
      stage,
      level,
      message,
      metadata,
    }, { throwOnError: true });
  };

  try {
    const result = await executeAutomationTurn({
      automation,
      baseUrl: getInternalApiBaseUrl(input.request),
      conversationId,
      prompt,
      userId: input.userId,
      serverSecret: input.serverSecret,
      turnId: `automation-${Date.now()}`,
      requestId: `manual-${automation._id}-${startedAt}`,
      executor,
      onEvent: (event) =>
        appendEvent(event.stage, event.level, event.message, event.metadata),
      onHeartbeat: async (stage) => {
        await convex.mutation("automations:updateRunHeartbeat", {
          automationRunId: runId,
          userId: input.userId,
          serverSecret: input.serverSecret,
          ...(stage ? { stage } : {}),
          lastHeartbeatAt: Date.now(),
        }, { throwOnError: true });
      },
    });
    const finishedAt = Date.now();

    await convex.mutation("automations:updateRun", {
      automationRunId: runId,
      userId: input.userId,
      serverSecret: input.serverSecret,
      status: "succeeded",
      stage: "succeeded",
      finishedAt,
      durationMs: finishedAt - startedAt,
      conversationId,
      turnId: result.turnId,
      assistantPersisted: true,
      assistantMessage: result.assistantMessage,
      executor,
      readinessState: "ready",
      resultSummary: result.summary,
    }, { throwOnError: true });
    await appendEvent(
      "succeeded",
      "info",
      "Manual automation run completed successfully.",
      { turnId: result.turnId },
    );

    return {
      success: true,
      automationRunId: runId,
      conversationId,
      turnId: result.turnId,
      resultSummary: result.summary,
    };
  } catch (error) {
    const finishedAt = Date.now();
    const message =
      error instanceof Error ? error.message : "Automation execution failed";
    const turnId =
      error &&
      typeof error === "object" &&
      "turnId" in error &&
      typeof error.turnId === "string"
        ? error.turnId
        : undefined;
    const failureStage =
      error &&
      typeof error === "object" &&
      "failureStage" in error &&
      typeof error.failureStage === "string"
        ? error.failureStage
        : "execute_model";

    await convex.mutation("automations:updateRun", {
      automationRunId: runId,
      userId: input.userId,
      serverSecret: input.serverSecret,
      status: "failed",
      stage: "failed",
      finishedAt,
      durationMs: finishedAt - startedAt,
      conversationId,
      turnId,
      failureStage,
      executor,
      errorCode: "manual_run_failed",
      errorMessage: message,
    }, { throwOnError: true });
    await appendEvent("failed", "error", "Manual automation run failed.", {
      error: message,
      failureStage,
    });

    throw error instanceof Error ? error : new Error(message);
  }
}
