/** InfraFlow emblem: 40x40 navy rounded square, white "M" glyph and cyan node (from the Stitch emblem export). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" width={size} height={size} role="img" aria-label="InfraFlow emblem">
      <rect width="40" height="40" rx="8" fill="#1e3a8a" />
      <path d="M12 28V12L20 20L28 12V28" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="3.5" fill="#38bdf8" />
      <path d="M8 20H12M28 20H32" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 28V32" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
