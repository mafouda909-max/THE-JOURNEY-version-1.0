/**
 * CONTACT-REQUEST STATE MACHINE — policy §13.
 *
 * Contact lifecycle: new → viewed → responded → closed.
 * Illegal transitions are rejected server-side, and every privileged
 * moderation/agent transition produces an audit record (see the route using
 * this module). The owning agent may drive the lifecycle; an admin may too.
 */
export const CONTACT_STATUSES = [
  "new",
  "viewed",
  "responded",
  "closed",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

// Directed graph of allowed transitions.
export const ALLOWED_CONTACT_TRANSITIONS: Record<ContactStatus, ContactStatus[]> = {
  new: ["viewed", "responded", "closed"],
  viewed: ["responded", "closed"],
  responded: ["closed"],
  closed: [],
};

export function isContactStatus(value: string): value is ContactStatus {
  return (CONTACT_STATUSES as readonly string[]).includes(value);
}

export function canTransitionContact(from: string, to: string): boolean {
  if (!isContactStatus(from) || !isContactStatus(to)) return false;
  return ALLOWED_CONTACT_TRANSITIONS[from].includes(to);
}
