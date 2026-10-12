"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { createContactRequestAction } from "@/lib/contact/actions";
import { ContactFields } from "./ContactFields";

/**
 * CONTACT PANEL — desktop shows an inline expandable card; mobile opens the
 * shared Sheet (SPEC §4.6: modal/inline, never a new page context). Both
 * instances post the same server action.
 */
export function ContactPanel({ offerId }: { offerId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* Desktop — inline disclosure */}
      <details className="hidden lg:block">
        <summary className="inline-flex w-full cursor-pointer list-none items-center justify-center rounded-md bg-primary px-4 min-h-11 text-label-lg text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          تواصل مع الوكيل
        </summary>
        <form action={createContactRequestAction} data-form="desktop" className="mt-4 rounded-md border border-outline-variant bg-surface p-4">
          <input type="hidden" name="offer_id" value={offerId} />
          <ContactFields p="c-d" />
          <Button type="submit" size="lg" className="mt-4 w-full">
            إرسال طلب التواصل
          </Button>
        </form>
      </details>

      {/* Mobile — bottom sheet */}
      <div className="lg:hidden">
        <Button className="w-full" onClick={() => setOpen(true)}>
          تواصل مع الوكيل
        </Button>
        <Sheet open={open} onClose={() => setOpen(false)} title="طلب تواصل للوكيل">
          <form action={createContactRequestAction} data-form="mobile-sheet">
            <input type="hidden" name="offer_id" value={offerId} />
            <ContactFields p="c-m" />
            <Button type="submit" size="lg" className="mt-4 w-full">
              إرسال طلب التواصل
            </Button>
          </form>
          <p className="mt-3 text-label-md text-on-surface-variant">
            يصل طلبك مباشرة للوكيل وتتابع حالته من هنا أو من ملفك الشخصي.
          </p>
        </Sheet>
      </div>
    </div>
  );
}
