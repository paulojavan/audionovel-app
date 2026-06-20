import { revalidateTag, unstable_cache } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
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
  const settings = await getSystemSettings();
  if (key === SYSTEM_SETTING_KEYS.registrationsEnabled) return settings.registrationsEnabled;
  if (key === SYSTEM_SETTING_KEYS.subscriptionsEnabled) return settings.subscriptionsEnabled;
  return defaultValue;
}

export const getSystemSettings = unstable_cache(async function getSystemSettings(): Promise<SystemSettings> {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(SYSTEM_SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    registrationsEnabled: values.get(SYSTEM_SETTING_KEYS.registrationsEnabled) !== "false",
    subscriptionsEnabled: values.get(SYSTEM_SETTING_KEYS.subscriptionsEnabled) !== "false",
  };
}, ["system-settings"], { revalidate: 60, tags: [CACHE_TAGS.settings] });

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
  revalidateTag(CACHE_TAGS.settings, "max");
}
