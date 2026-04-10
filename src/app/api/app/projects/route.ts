import { NextRequest, NextResponse } from "next/server";
import { getInternalApiSecret } from "@/lib/internal-api-secret";
import { resolveAuthenticatedAppUser } from "@/lib/app-api-auth";
import { readOptionalBooleanParam } from "@/lib/app-api/conversation-contract";
import {
  createAppProject,
  deleteAppProject,
  getAppProject,
  listAppProjects,
  updateAppProject,
} from "@/lib/app-api/project-service";

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {});
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const serverSecret = getInternalApiSecret();
    const projectId = request.nextUrl.searchParams.get("projectId");

    if (projectId) {
      const project = await getAppProject(auth.userId, serverSecret, projectId);
      if (!project)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(project);
    }

    const updatedSinceParam = request.nextUrl.searchParams.get("updatedSince");
    const updatedSince = updatedSinceParam
      ? Number(updatedSinceParam)
      : undefined;
    const includeDeleted = readOptionalBooleanParam(
      request.nextUrl.searchParams.get("includeDeleted"),
    );

    const projects = await listAppProjects(auth.userId, serverSecret, {
      ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
      ...(includeDeleted !== undefined ? { includeDeleted } : {}),
    });
    return NextResponse.json(projects);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string;
      parentId?: string | null;
      instructions?: string;
      clientId?: string;
      accessToken?: string;
      userId?: string;
    };
    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { name, parentId, instructions, clientId } = body;
    if (!name)
      return NextResponse.json({ error: "name required" }, { status: 400 });
    return NextResponse.json(
      await createAppProject({
        userId: auth.userId,
        serverSecret: getInternalApiSecret(),
        clientId,
        name,
        instructions,
        parentId,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      projectId?: string;
      name?: string;
      instructions?: string;
      parentId?: string | null;
      accessToken?: string;
      userId?: string;
    };
    const auth = await resolveAuthenticatedAppUser(request, body);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { projectId, name, instructions, parentId } = body;
    if (!projectId)
      return NextResponse.json(
        { error: "projectId required" },
        { status: 400 },
      );
    return NextResponse.json(
      await updateAppProject({
        userId: auth.userId,
        serverSecret: getInternalApiSecret(),
        projectId,
        name,
        instructions,
        parentId,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to update project" },
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
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId)
      return NextResponse.json(
        { error: "projectId required" },
        { status: 400 },
      );

    return NextResponse.json(
      await deleteAppProject(auth.userId, serverSecret, projectId),
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}
