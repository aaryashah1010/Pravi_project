import clsx from 'clsx';

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

/** Material Symbols Outlined glyph (font is bundled; no CDN). Decorative: pair with a text label. */
export function Icon({ name, className, filled }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx('material-symbols-outlined select-none leading-none', className ?? 'text-[18px]')}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}
