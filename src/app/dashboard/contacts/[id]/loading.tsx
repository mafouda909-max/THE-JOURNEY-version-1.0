import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function LoadingContactDetail() {
  return (
    <div className="mx-auto max-w-3xl">
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="mb-5 h-8 w-2/3" />
      <Card className="space-y-3 p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
      <Card className="mt-6 space-y-3 p-5">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-32 rounded-md" />
      </Card>
    </div>
  );
}
