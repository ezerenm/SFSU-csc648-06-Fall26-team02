import { createHandlers } from "@/lib/spatial/server/handlers";
import { createSpatialRepository } from "@/lib/spatial/server/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createHandlers(createSpatialRepository).graph;
