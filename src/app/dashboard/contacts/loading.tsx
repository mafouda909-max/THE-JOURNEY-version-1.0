import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function LoadingContacts() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-10">
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-6 h-4 w-80" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="space-y-2 p-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
