import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Base({
  title,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function SilaSearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="5.75" />
      <path d="m15 15 4.25 4.25" />
      <circle cx="4.25" cy="4.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="6.75" cy="4.5" r=".75" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function SilaIdentityIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="6" width="17" height="13" rx="4" />
      <circle cx="8.25" cy="11" r="1.75" />
      <path d="M6 16c.8-1.65 3.7-1.65 4.5 0" />
      <path d="M13.5 10h4M13.5 13h3.25" />
      <circle cx="17.75" cy="4" r=".8" fill="currentColor" stroke="none" />
      <circle cx="20.25" cy="4" r=".8" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function SilaReviewIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 5.5h11.5a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7.5a3 3 0 0 1-3-3V9" />
      <path d="M8 10h7.5M8 13h5.5" />
      <path d="m15.75 16 1.35 1.35 2.65-3" />
      <circle cx="4.5" cy="4" r=".8" fill="currentColor" stroke="none" />
      <circle cx="7" cy="4" r=".8" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function SilaConversationIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6.5h16v9a3 3 0 0 1-3 3h-7l-4 2v-2H7a3 3 0 0 1-3-3z" />
      <circle cx="9" cy="12.25" r=".8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12.25" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12.25" r=".8" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function SilaCompareIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 7.5h13M5 12h10M5 16.5h7" />
      <circle cx="19" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function SilaAgentIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10" cy="8" r="3" />
      <path d="M4.5 18.5c.7-3.2 3-5 5.5-5s4.8 1.8 5.5 5" />
      <path d="M17 8.5h3.5M18.75 6.75v3.5" />
      <circle cx="18.75" cy="14.75" r=".8" fill="currentColor" stroke="none" />
      <circle cx="21" cy="14.75" r=".8" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function SilaArrowIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M19 12H5" />
      <path d="m9.25 7.75-4.25 4.25 4.25 4.25" />
      <circle cx="18.5" cy="7" r=".8" fill="currentColor" stroke="none" />
      <circle cx="21" cy="7" r=".8" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function SilaSparkIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5v17M3.5 12h17" />
      <path d="M6 6l12 12M18 6 6 18" opacity=".45" />
      <circle cx="4.25" cy="4" r=".75" fill="currentColor" stroke="none" />
      <circle cx="6.75" cy="4" r=".75" fill="currentColor" stroke="none" />
    </Base>
  );
}
