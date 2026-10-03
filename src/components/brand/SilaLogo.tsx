import Image from "next/image";

type SilaLogoVariant = "arabic" | "english" | "primary";

const dimensions: Record<SilaLogoVariant, { width: number; height: number }> = {
  arabic: { width: 1009, height: 504 },
  english: { width: 773, height: 234 },
  primary: { width: 1009, height: 716 },
};

export function SilaLogo({
  variant = "arabic",
  light = false,
  className = "",
  priority = false,
}: {
  variant?: SilaLogoVariant;
  light?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const suffix = light && variant !== "english" ? "-white" : "";
  const file =
    variant === "arabic"
      ? `/brand/sila-logo-ar${suffix}.svg`
      : variant === "english"
        ? "/brand/sila-logo-en.svg"
        : `/brand/sila-logo-primary${suffix}.svg`;
  const size = dimensions[variant];

  return (
    <Image
      src={file}
      alt={variant === "english" ? "SILA" : "صلة"}
      width={size.width}
      height={size.height}
      priority={priority}
      className={className}
    />
  );
}
