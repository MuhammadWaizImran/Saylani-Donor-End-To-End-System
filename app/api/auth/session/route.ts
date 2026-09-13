import { forwardToBackend } from "@/lib/backend-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;
export const GET = forwardToBackend;
