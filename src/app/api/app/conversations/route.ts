import { NextRequest, NextResponse } from "next/server";
import { getInternalApiSecret } from "@/lib/internal-api-secret";
import { resolveAuthenticatedAppUser } from "@/lib/app-api-auth";
import {
  createAppConversation,
  deleteAppConversation,
  getAppConversation,
  listAppConversationMessages,
  listAppConversations,
  updateAppConversation,
} from "@/lib/app-api/conversation-service";
import { readOptionalBooleanParam } from "@/lib/app-api/conversation-contract";

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {});
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const serverSecret = getInternalApiSecret();

    const { searchParams } = request.nextUrl;
    const conversationId = searchParams.get("conversationId");
    const includeMessages = searchParams.get("messages") === "true";
    const projectId = searchParams.get("projectId");
    const updatedSinceParam = searchParams.get("updatedSince");
    const updatedSince = updatedSinceParam
      ? Number(updatedSinceParam)
      : undefined;
    const includeDeleted = readOptionalBooleanParam(
      searchParams.get("includeDeleted"),
    );

    if (conversationId && !includeMessages) {
      const conv = await getAppConversation(
        auth.userId,
        serverSecret,
        conversationId,
      );
      if (!conv)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(conv);
    }

    if (conversationId && includeMessages) {
      return NextResponse.json({
        messages: await listAppConversationMessages(
          auth.userId,
          serverSecret,
          conversationId,
        ),
      });
    }

    const list = await listAppConversations(auth.userId, serverSecret, {
      ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
      ...(includeDeleted !== undefined ? { includeDeleted } : {}),
      ...(projectId ? { projectId } : {}),
    });

    return NextResponse.json(list);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string;
      projectId?: string;
      askModelIds?: string[];
      actModelId?: string;
      lastMode?: "ask" | "act";
      clientId?: string;
      accessToken?: string;
      userId?: string;
    };
    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await createAppConversation({
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
      clientId: body.clientId,
      title: body.title,
      projectId: body.projectId ?? undefined,
      askModelIds: body.askModelIds,
      actModelId: body.actModelId,
      lastMode: body.lastMode,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      conversationId?: string;
      title?: string;
      projectId?: string;
      askModelIds?: string[];
      actModelId?: string;
      lastMode?: "ask" | "act";
      accessToken?: string;
      userId?: string;
    };
    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!body.conversationId) {
      return NextResponse.json(
        { error: "conversationId required" },
        { status: 400 },
      );
    }

    const result = await updateAppConversation({
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
      conversationId: body.conversationId,
      title: body.title,
      projectId: body.projectId,
      askModelIds: body.askModelIds,
      actModelId: body.actModelId,
      lastMode: body.lastMode,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[conversations PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { accessToken?: string; userId?: string } = {};
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }
    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const serverSecret = getInternalApiSecret();

    const conversationId = request.nextUrl.searchParams.get("conversationId");
    if (!conversationId)
      return NextResponse.json(
        { error: "conversationId required" },
        { status: 400 },
      );

    return NextResponse.json(
      await deleteAppConversation(auth.userId, serverSecret, conversationId),
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 },
    );
  }
}
