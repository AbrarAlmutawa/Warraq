import Image from "next/image";
import Link from "next/link";

type WarraqLogoProps = {
  size?: "md" | "sm";
  href?: string;
  className?: string;
};

/* Official lockup (wordmark + symbol) from the approved asset — never typeset. */
const LOGO_WIDTH = 633;
const LOGO_HEIGHT = 195;

const HEIGHT_CLASS = {
  md: "h-[34px]",
  sm: "h-[28px]",
} as const;

export function WarraqLogo({ size = "md", href = "/", className = "" }: WarraqLogoProps) {
  return (
    <Link href={href} className={`inline-flex shrink-0 ${className}`}>
      <Image
        src="/brand/warraq-logo.png"
        alt="وَرَّاق"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        loading="eager"
        className={`${HEIGHT_CLASS[size]} w-auto`}
      />
    </Link>
  );
}