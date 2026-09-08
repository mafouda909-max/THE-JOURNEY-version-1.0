import { RequestTracking } from "@/components/RequestTracking";
export const metadata = {
  title: "متابعة طلب التواصل",
  robots: { index: false, follow: false },
};
export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RequestTracking id={(await params).id} />;
}
