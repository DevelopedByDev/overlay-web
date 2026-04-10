import { convex } from "@/lib/convex";
import type {
  AppUiSettings,
  AppUpdateUiSettingsInput,
} from "@/lib/app-api/settings-contract";

export async function getAppUiSettings(
  userId: string,
  serverSecret: string,
): Promise<AppUiSettings> {
  return await convex.query<AppUiSettings>(
    "uiSettings:getByServer",
    {
      userId,
      serverSecret,
    },
    { throwOnError: true },
  );
}

export async function updateAppUiSettings(
  input: AppUpdateUiSettingsInput,
): Promise<AppUiSettings> {
  const mutationArgs: AppUpdateUiSettingsInput = {
    userId: input.userId,
    serverSecret: input.serverSecret,
  };

  if (input.theme !== undefined) {
    mutationArgs.theme = input.theme;
  }
  if (input.useSecondarySidebar !== undefined) {
    mutationArgs.useSecondarySidebar = input.useSecondarySidebar;
  }

  return await convex.mutation<AppUiSettings>(
    "uiSettings:upsertByServer",
    mutationArgs,
    { throwOnError: true },
  );
}
