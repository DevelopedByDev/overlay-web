import { convex } from "@/lib/convex";
import {
  hashTextContent,
  partedFileName,
  splitTextForConvexDocuments,
} from "@/lib/convex-file-content";
import { checkGlobalR2Budget } from "@/lib/r2-budget";
import {
  deleteObjects,
  generatePresignedUploadUrl,
  keyForFile,
} from "@/lib/r2";
import type {
  AppCreateFileInput,
  AppCreateFileResult,
  AppDeleteFileResult,
  AppFileListFilters,
  AppFileProxyTarget,
  AppFileRecord,
  AppFileUploadUrlInput,
  AppFileUploadUrlResult,
  AppUpdateFileInput,
  AppUpdateFileResult,
} from "@/lib/app-api/file-contract";

interface AppStorageEntitlements {
  overlayStorageBytesUsed: number;
  overlayStorageBytesLimit: number;
}

export async function listAppFiles(
  userId: string,
  serverSecret: string,
  filters: AppFileListFilters = {},
): Promise<AppFileRecord[]> {
  return (
    (await convex.query<AppFileRecord[]>("files:list", {
      userId,
      serverSecret,
      ...(filters.projectId !== undefined ? { projectId: filters.projectId } : {}),
    })) || []
  );
}

export async function getAppFile(
  userId: string,
  serverSecret: string,
  fileId: string,
): Promise<AppFileRecord | null> {
  return await convex.query<AppFileRecord | null>("files:get", {
    fileId,
    userId,
    serverSecret,
  });
}

export async function createAppFile(
  input: AppCreateFileInput,
): Promise<AppCreateFileResult> {
  if (input.storageId) {
    throw new Error(
      "Convex file storage is no longer supported. Upload to R2 and pass r2Key from the upload-url flow.",
    );
  }

  const args: Record<string, unknown> = {
    userId: input.userId,
    serverSecret: input.serverSecret,
    name: input.name,
    type: input.type,
  };
  if (input.parentId) args.parentId = input.parentId;
  if (input.projectId) args.projectId = input.projectId;

  let id: string;
  const ids: string[] = [];

  if (input.r2Key) {
    const { type: _type, ...storageArgs } = args;
    void _type;
    id = await convex.mutation<string>("files:createWithStorage", {
      ...storageArgs,
      r2Key: input.r2Key,
      sizeBytes:
        typeof input.sizeBytes === "number"
          ? Math.max(0, Math.round(input.sizeBytes))
          : 0,
    });
  } else if (
    input.type === "file" &&
    typeof input.content === "string" &&
    input.content.length > 0
  ) {
    const parts = splitTextForConvexDocuments(input.content);
    const total = parts.length;
    for (let p = 0; p < parts.length; p += 1) {
      const part = parts[p]!;
      const partName = partedFileName(input.name, p + 1, total);
      const partId = await convex.mutation<string>("files:create", {
        ...args,
        name: partName,
        content: part,
        contentHash: hashTextContent(part),
      });
      if (!partId) {
        throw new Error("Failed to create file part");
      }
      ids.push(partId);
    }
    id = ids[0]!;
  } else {
    if (typeof input.content === "string" && input.content.length > 0) {
      args.content = input.content;
      args.contentHash = hashTextContent(input.content);
    }
    id = await convex.mutation<string>("files:create", args);
  }

  return {
    id,
    ...(ids.length ? { ids, parts: ids.length } : {}),
  };
}

export async function updateAppFile(
  input: AppUpdateFileInput,
): Promise<AppUpdateFileResult> {
  const args: Record<string, unknown> = {
    fileId: input.fileId,
    userId: input.userId,
    serverSecret: input.serverSecret,
  };
  if (input.name !== undefined) args.name = input.name;
  if (typeof input.content === "string") {
    args.content = input.content;
    args.contentHash = hashTextContent(input.content);
  } else if (input.content !== undefined) {
    args.content = input.content;
  }

  await convex.mutation("files:update", args);
  return { success: true };
}

export async function deleteAppFile(
  userId: string,
  serverSecret: string,
  fileId: string,
): Promise<AppDeleteFileResult> {
  const r2Entries = await convex.query<
    Array<{ fileId: string; r2Key?: string; storageId?: string }>
  >("files:getR2KeysForSubtree", {
    fileId,
    userId,
    serverSecret,
  });
  const r2Keys = (r2Entries ?? [])
    .map((entry) => entry.r2Key)
    .filter((key): key is string => Boolean(key));
  if (r2Keys.length > 0) {
    await deleteObjects(r2Keys);
    console.log(
      `[FilesDelete] Deleted ${r2Keys.length} R2 objects for fileId=${fileId}`,
    );
  }

  await convex.mutation("files:remove", {
    fileId,
    userId,
    serverSecret,
  });

  return { success: true };
}

export async function getAppFileProxyTarget(
  userId: string,
  serverSecret: string,
  fileId: string,
): Promise<AppFileProxyTarget | null> {
  return await convex.query<AppFileProxyTarget | null>(
    "files:getStorageUrlForProxy",
    {
      fileId,
      userId,
      serverSecret,
    },
    { throwOnError: true },
  );
}

export async function createAppFileUploadUrl(
  input: AppFileUploadUrlInput,
): Promise<AppFileUploadUrlResult> {
  const normalizedSizeBytes =
    typeof input.sizeBytes === "number" &&
    Number.isFinite(input.sizeBytes) &&
    input.sizeBytes > 0
      ? Math.round(input.sizeBytes)
      : 0;
  if (normalizedSizeBytes <= 0) {
    throw new Error("sizeBytes is required");
  }

  const entitlements = await convex.query<AppStorageEntitlements | null>(
    "usage:getEntitlementsByServer",
    {
      serverSecret: input.serverSecret,
      userId: input.userId,
    },
  );
  if (!entitlements) {
    throw new Error("Could not verify subscription.");
  }
  if (
    entitlements.overlayStorageBytesUsed + normalizedSizeBytes >
    entitlements.overlayStorageBytesLimit
  ) {
    throw new Error("storage_limit_exceeded");
  }

  await checkGlobalR2Budget(normalizedSizeBytes);

  const fileName = input.name ?? `upload-${Date.now()}`;
  const fileIdPlaceholder = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const r2Key = keyForFile(input.userId, fileIdPlaceholder, fileName);
  const presignedUrl = await generatePresignedUploadUrl(
    r2Key,
    input.mimeType ?? "application/octet-stream",
  );

  return {
    r2Key,
    presignedUrl,
    expiresIn: Number(process.env["R2_PRESIGN_TTL_SECONDS"] ?? 300),
  };
}
