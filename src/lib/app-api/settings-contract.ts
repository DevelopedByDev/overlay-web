export type AppUiTheme = "light" | "dark";

export interface AppUiSettings {
  theme: AppUiTheme;
  useSecondarySidebar: boolean;
}

export interface AppUpdateUiSettingsInput {
  userId: string;
  serverSecret: string;
  theme?: AppUiTheme;
  useSecondarySidebar?: boolean;
}
