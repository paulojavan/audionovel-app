import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createDeviceToken,
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
  getDeviceIdFromToken,
} from "@/lib/device-identity";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(DEVICE_COOKIE_NAME)?.value ?? null;
  const body = await request.json().catch(() => ({})) as { backupToken?: unknown };
  const backupToken = typeof body.backupToken === "string" && body.backupToken.length <= 512
    ? body.backupToken
    : null;

  const token = getDeviceIdFromToken(cookieToken)
    ? cookieToken as string
    : getDeviceIdFromToken(backupToken)
      ? backupToken as string
      : createDeviceToken();

  const response = NextResponse.json({ token });
  response.cookies.set(DEVICE_COOKIE_NAME, token, {
    httpOnly: false,
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
