import { NextRequest, NextResponse } from "next/server";
import { getInternalApiSecret } from "@/lib/internal-api-secret";
import { resolveAuthenticatedAppUser } from "@/lib/app-api-auth";
import {
  deleteAppConversationMessage,
  persistAppConversationMessage,
} from "@/lib/app-api/conversation-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      conversationId?: string;
      turnId?: string;
      mode?: "ask" | "act";
      role?: "user" | "assistant";
      content?: string;
      parts?: Array<{
        type: string;
        text?: string;
        url?: string;
        mediaType?: string;
      }>;
      attachmentNames?: string[];
      model?: string;
      modelId?: string;
      contentType?: "text" | "image" | "video";
      variantIndex?: number;
      replyToTurnId?: string;
      replySnippet?: string;
      accessToken?: string;
      userId?: string;
    };
    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!body.conversationId || !body.role || !body.turnId?.trim()) {
      return NextResponse.json(
        {
          error:
            "conversationId, turnId, role, and content or attachment are required",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await persistAppConversationMessage({
        userId: auth.userId,
        serverSecret: getInternalApiSecret(),
        conversationId: body.conversationId,
        turnId: body.turnId,
        mode: body.mode,
        role: body.role,
        content: body.content,
        parts: body.parts,
        attachmentNames: body.attachmentNames,
        model: body.model,
        modelId: body.modelId,
        contentType: body.contentType,
        variantIndex: body.variantIndex,
        replyToTurnId: body.replyToTurnId,
        replySnippet: body.replySnippet,
      }),
    );
  } catch (e) {
    console.error("[conversations/message POST]", e);
    const msg = e instanceof Error ? e.message : "Failed to save message";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      conversationId?: string;
      turnId?: string;
      accessToken?: string;
      userId?: string;
    };
    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const conversationId = body.conversationId?.trim();
    const turnId = body.turnId?.trim();
    if (!conversationId || !turnId) {
      return NextResponse.json(
        { error: "conversationId and turnId are required" },
        { status: 400 },
      );
    }

    try {
      return NextResponse.json(
        await deleteAppConversationMessage({
          userId: auth.userId,
          serverSecret: getInternalApiSecret(),
          conversationId,
          turnId,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "Unauthorized" || msg.includes("Unauthorized")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (msg.includes("Could not find public function")) {
        return NextResponse.json(
          {
            error:
              "Delete is unavailable until Convex is deployed with deleteTurn. Run `npx convex deploy` (or `npx convex dev`) for this project.",
          },
          { status: 503 },
        );
      }
      console.error("[conversations/message DELETE]", err);
      return NextResponse.json(
        { error: msg || "Failed to delete turn" },
        { status: 500 },
      );
    }
  } catch (e) {
    console.error("[conversations/message DELETE]", e);
    return NextResponse.json(
      { error: "Failed to delete turn" },
      { status: 500 },
    );
  }
}
