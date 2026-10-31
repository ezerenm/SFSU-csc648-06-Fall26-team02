import HealthPanel from "@/components/health/HealthPanel";

export const metadata = { title: "Localization health | SpatialOS" };

/** R14 health colors + R16.1 AI summary. Calvin can move HealthPanel into the operator dashboard. */
export default function HealthPage() {
  return (
    <main className="flex-1">
      <HealthPanel />
    </main>
  );
}
