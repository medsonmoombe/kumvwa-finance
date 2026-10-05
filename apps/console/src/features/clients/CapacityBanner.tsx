import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';

import { ProgressBar } from '../../components/ui';
import { KitButton } from '../../components/kit';
import type { CapacityState } from './useLenderCapacity';

/**
 * The "you're out of client capacity" banner, shown on the two pages where a
 * lender adds clients.
 *
 * The point is to explain *before* the user hits the wall: an invite that fails
 * with 402 looks like a bug, whereas "buy a slot for K100/month" is a decision.
 * The 402 remains the actual enforcement — this only tells the user what's
 * coming and how to resolve it.
 *
 * Severity is graduated so it isn't shouting on every visit: a plain line while
 * headroom remains, an amber line when it's the last slot, and a firm prompt
 * with the price at the limit.
 */
export function CapacityBanner({ state }: { state: CapacityState }) {
  const nav = useNavigate();

  if (state.kind !== 'ready') return null;
  const { capacity: c, plan } = state.cap;

  // A suspended account is a support matter, not a purchase — the buy button
  // would fail and point the user at the wrong fix.
  if (c.blocked) {
    return (
      <div className="mb-3 flex items-start gap-2.5 rounded-card border border-[#F3D3D3] bg-[#FDF4F4] px-3.5 py-3">
        <FiAlertTriangle size={14} className="mt-0.5 shrink-0 text-danger-600" />
        <div>
          <b className="block text-[12px] text-danger-700">
            Lending is paused on this account
          </b>
          <span className="text-[11.5px] text-ink-2">
            You cannot add new clients until Kumvwa restores your subscription.
          </span>
        </div>
      </div>
    );
  }

  if (c.canAddClient && c.remaining > 1) return null;

  const atLimit = !c.canAddClient;

  return (
    <div
      className={`mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border px-3.5 py-3 ${
        atLimit
          ? 'border-[#F0D9B5] bg-[#FDF8F0]'
          : 'border-[#E7EAF1] bg-[#F5F6F8]'
      }`}
    >
      <div className="min-w-[220px] flex-1">
        <b className="block text-[12px]">
          {atLimit
            ? `Client limit reached — ${c.used} of ${c.capacity}`
            : `Last client slot — ${c.used} of ${c.capacity} used`}
        </b>
        <div className="mt-1.5 max-w-[280px]">
          <ProgressBar
            pct={
              c.capacity === 0
                ? 100
                : Math.min(100, Math.round((c.used / c.capacity) * 100))
            }
            danger={atLimit}
          />
        </div>
        <span className="mt-1.5 block text-[11.5px] text-ink-muted">
          {atLimit ? (
            <>
              The first {plan.includedClients} client{plan.includedClients === 1 ? '' : 's'} are
              free. Add more for <b>{c.unitPrice}/client/month</b>.
            </>
          ) : (
            <>
              Your next client will use your last free slot. After that it costs{' '}
              <b>{c.unitPrice}/client/month</b>.
            </>
          )}
        </span>
      </div>
      <KitButton
        tone={atLimit ? 'create' : 'neutral'}
        onClick={() => nav('/settings?tab=billing')}
      >
        {atLimit ? `Buy a slot — ${c.unitPrice}/mo` : 'Manage billing'}
      </KitButton>
    </div>
  );
}
