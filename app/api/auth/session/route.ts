import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";

/** Lets the client-side reactive session store read the httpOnly cookie. */
export async function GET(req: Request) {
  const session = await getSessionUser(req);
  return NextResponse.json({ session });
}
