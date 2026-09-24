import type { ReactNode } from "react";
import { WarraqLogo } from "@/components/brand/WarraqLogo";

type SiteHeaderProps = {
  aside?: ReactNode;
};

export function SiteHeader({ aside }: SiteHeaderProps) {
  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-rule px-6 lg:px-[72px]">
      <WarraqLogo />
      {aside}
    </header>
  );
}