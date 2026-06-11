import React from 'react';
import { FlaskConical } from 'lucide-react';

/**
 * SimulatedBadge — a clear, honest marker for any feed whose data is
 * synthetic/demo rather than live exchange data. Use it wherever the
 * backend generates values (microstructure tape, smart alerts, etc.)
 * so users are never misled about what is real.
 *
 * Props:
 *   - label: badge text (default "SIMULATED")
 *   - title: tooltip explaining what is simulated
 *   - size:  "sm" | "md"
 */
export default function SimulatedBadge({ label = 'SIMULATED', title = 'Demo data — generated for illustration, not a live market feed.', size = 'md', className = '' }) {
  const dims = size === 'sm' ? 'text-[9px] px-1.5 py-0.5 gap-1' : 'text-[10px] px-2 py-1 gap-1.5';
  const icon = size === 'sm' ? 10 : 12;
  return (
    <span
      title={title}
      className={`inline-flex items-center ${dims} rounded-md font-black uppercase tracking-widest
        bg-amber-500/10 text-amber-400 border border-amber-500/25 select-none ${className}`}
    >
      <FlaskConical size={icon} />
      {label}
    </span>
  );
}
