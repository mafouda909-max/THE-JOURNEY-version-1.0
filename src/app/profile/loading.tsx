import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function LoadingProfile() {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-8 md:px-6">
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-8 h-4 w-64" />
      <Card className="mb-8 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </Card>
      <Skeleton className="mb-3 h-6 w-36" />
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Card key={i} className="space-y-2 p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </Card>
        ))}
      </div>
    </div>
  );
}
