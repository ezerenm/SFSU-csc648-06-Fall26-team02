import { createHandlers } from "@/lib/spatial/server/handlers";
import { createSpatialRepository } from "@/lib/spatial/server/repository";
import { routingFunction } from "@/lib/spatial/server/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createHandlers(createSpatialRepository, routingFunction).route;
