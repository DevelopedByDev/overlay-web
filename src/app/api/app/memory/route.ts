import { NextRequest, NextResponse } from "next/server";
import { getInternalApiSecret } from "@/lib/internal-api-secret";
import {
  createAppMemories,
  deleteAppMemory,
  getAppMemory,
  listAppMemoryDocs,
  listAppMemoryRows,
  updateAppMemory,
} from "@/lib/app-api/memory-service";
import { resolveAuthenticatedAppUser } from "@/lib/app-api-auth";
import { readOptionalBooleanParam } from "@/lib/app-api/memory-contract";

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {});
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const serverSecret = getInternalApiSecret();
    const memoryId = request.nextUrl.searchParams.get("memoryId");
    const raw =
      readOptionalBooleanParam(request.nextUrl.searchParams.get("raw")) ===
      true;
    const updatedSinceParam = request.nextUrl.searchParams.get("updatedSince");
    const updatedSince = updatedSinceParam
      ? Number(updatedSinceParam)
      : undefined;
    const includeDeleted = readOptionalBooleanParam(
      request.nextUrl.searchParams.get("includeDeleted"),
    );
    const projectId =
      request.nextUrl.searchParams.get("projectId") ?? undefined;
    const conversationId =
      request.nextUrl.searchParams.get("conversationId") ?? undefined;
    const noteId = request.nextUrl.searchParams.get("noteId") ?? undefined;

    if (memoryId) {
      const match = await getAppMemory(auth.userId, serverSecret, memoryId);
      if (!match || (!raw && match.deletedAt)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(match);
    }

    const filters = {
      ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
      ...(includeDeleted !== undefined ? { includeDeleted } : {}),
      ...(projectId ? { projectId } : {}),
      ...(conversationId ? { conversationId } : {}),
      ...(noteId ? { noteId } : {}),
    };

    return NextResponse.json(
      raw
        ? await listAppMemoryDocs(auth.userId, serverSecret, filters)
        : await listAppMemoryRows(auth.userId, serverSecret, filters),
    );
  } catch (error) {
    console.error("[Memory API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch memories" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      content?: string;
      source?: string;
      clientId?: string;
      type?: "preference" | "fact" | "project" | "decision" | "agent";
      importance?: number;
      projectId?: string;
      conversationId?: string;
      noteId?: string;
      messageId?: string;
      turnId?: string;
      tags?: string[];
      actor?: "user" | "agent";
      status?: "candidate" | "approved" | "rejected";
      accessToken?: string;
      userId?: string;
    };

    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const serverSecret = getInternalApiSecret();

    const trimmed = (body.content ?? "").trim();
    if (!trimmed)
      return NextResponse.json({ error: "content required" }, { status: 400 });

    const result = await createAppMemories({
      userId: auth.userId,
      serverSecret,
      clientId: body.clientId,
      content: trimmed,
      source: body.source,
      type: body.type,
      importance: body.importance,
      projectId: body.projectId,
      conversationId: body.conversationId,
      noteId: body.noteId,
      messageId: body.messageId,
      turnId: body.turnId,
      tags: body.tags,
      actor: body.actor,
      status: body.status,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Memory API] POST error:", error);
    return NextResponse.json(
      { error: "Failed to add memory" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      memoryId?: string;
      content?: string;
      source?: "chat" | "note" | "manual";
      type?: "preference" | "fact" | "project" | "decision" | "agent";
      importance?: number;
      projectId?: string;
      conversationId?: string;
      noteId?: string;
      messageId?: string;
      turnId?: string;
      tags?: string[];
      actor?: "user" | "agent";
      status?: "candidate" | "approved" | "rejected";
      accessToken?: string;
      userId?: string;
    };

    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const serverSecret = getInternalApiSecret();

    if (
      !body.memoryId?.trim() ||
      body.content === undefined ||
      body.content === ""
    ) {
      return NextResponse.json(
        { error: "memoryId and content required" },
        { status: 400 },
      );
    }

    const result = await updateAppMemory({
      userId: auth.userId,
      serverSecret,
      memoryId: body.memoryId.trim(),
      content: body.content,
      source: body.source,
      type: body.type,
      importance: body.importance,
      projectId: body.projectId,
      conversationId: body.conversationId,
      noteId: body.noteId,
      messageId: body.messageId,
      turnId: body.turnId,
      tags: body.tags,
      actor: body.actor,
      status: body.status,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Memory API] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update memory" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { memoryId?: string; accessToken?: string; userId?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      // Browser sends query params only
    }

    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const serverSecret = getInternalApiSecret();

    const memoryId =
      body.memoryId ?? request.nextUrl.searchParams.get("memoryId");
    if (!memoryId)
      return NextResponse.json({ error: "memoryId required" }, { status: 400 });

    return NextResponse.json(
      await deleteAppMemory({
        memoryId,
        userId: auth.userId,
        serverSecret,
      }),
    );
  } catch (error) {
    console.error("[Memory API] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete memory" },
      { status: 500 },
    );
  }
}
