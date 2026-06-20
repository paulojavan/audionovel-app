import { prisma } from "./prisma";

export const SYSTEM_SETTING_KEYS = {
  registrationsEnabled: "registrationsEnabled",
  subscriptionsEnabled: "subscriptionsEnabled",
} as const;

export type SystemSettings = {
  registrationsEnabled: boolean;
  subscriptionsEnabled: boolean;
};

export async function getSystemSettingBoolean(key: string, defaultValue: boolean) {
  const setting = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
  if (!setting) return defaultValue;
  return setting.value === "true";
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(SYSTEM_SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    registrationsEnabled: values.get(SYSTEM_SETTING_KEYS.registrationsEnabled) !== "false",
    subscriptionsEnabled: values.get(SYSTEM_SETTING_KEYS.subscriptionsEnabled) !== "false",
  };
}

export async function updateSystemSettings(settings: SystemSettings) {
  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: SYSTEM_SETTING_KEYS.registrationsEnabled },
      create: { key: SYSTEM_SETTING_KEYS.registrationsEnabled, value: String(settings.registrationsEnabled) },
      update: { value: String(settings.registrationsEnabled) },
    }),
    prisma.systemSetting.upsert({
      where: { key: SYSTEM_SETTING_KEYS.subscriptionsEnabled },
      create: { key: SYSTEM_SETTING_KEYS.subscriptionsEnabled, value: String(settings.subscriptionsEnabled) },
      update: { value: String(settings.subscriptionsEnabled) },
    }),
  ]);
}
