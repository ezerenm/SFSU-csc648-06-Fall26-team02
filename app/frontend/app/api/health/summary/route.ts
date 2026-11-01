import { createHandlers } from "@/lib/spatial/server/handlers";
import { geminiFromEnv } from "@/lib/spatial/server/gemini";
import { createSpatialRepository } from "@/lib/spatial/server/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Gemini has a 15 s limit; leave room for the database reads.
export const maxDuration = 30;

export const POST = createHandlers(createSpatialRepository, null, geminiFromEnv).healthSummary;
