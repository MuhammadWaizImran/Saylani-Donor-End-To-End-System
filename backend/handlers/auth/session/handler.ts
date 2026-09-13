import { getSessionUser } from "@/backend/auth/session";

/** Lets the client-side reactive session store read the httpOnly cookie. */
export async function GET(req: Request) {
  const session = await getSessionUser(req);
  return Response.json({ session });
}
