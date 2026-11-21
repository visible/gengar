import Link from 'next/link';

export function Header({
  title,
  href,
  action,
  className
}: {
  title: string;
  href: string;
  action: string;
  className: string;
}) {
  return (
    <header className={`flex justify-end gap-4 ${className}`}>
      <h1 className="text-[10.5px] leading-[1.35] font-normal whitespace-nowrap [text-box:trim-both_cap_alphabetic]">
        <span className="block font-bold">Gengar</span>
        {title}
      </h1>
      <Link
        href={href}
        className="flex items-center border border-current px-3 text-[11px] leading-none font-bold transition-colors hover:bg-ink hover:text-paper"
      >
        <span className="[text-box:trim-both_cap_alphabetic]">{action}</span>
      </Link>
    </header>
  );
}
