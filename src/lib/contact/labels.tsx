import type { ReactNode } from "react";

/**
 * Contact-request lifecycle vocabulary (AD-08 single unified status;
 * DATABASE_DESIGN §2.8). Never render raw enum values — everything goes
 * through this map.
 */
export const CONTACT_STATUS_AR: Record<string, string> = {
  new: "جديد",
  viewed: "تمت المشاهدة",
  responded: "تم الرد",
  closed: "مغلق",
  cancelled: "ملغي",
};

export type StatusTone = "success" | "error" | "warning" | "neutral";

export function contactStatusTone(status: string): StatusTone {
  switch (status) {
    case "responded":
      return "success";
    case "cancelled":
      return "error";
    case "new":
      return "warning";
    default:
      return "neutral"; // viewed / closed
  }
}

/** Badge node for a contact status — the ONLY sanctioned rendering path. */
export function ContactStatusLabel({
  status,
  labels = CONTACT_STATUS_AR,
}: {
  status: string;
  labels?: Record<string, string>;
}): ReactNode {
  return labels[status] ?? status;
}
