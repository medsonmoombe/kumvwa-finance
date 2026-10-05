import { useCallback, useEffect, useState } from 'react';

import { api } from '../../lib/api';

/** The capacity slice of `GET /billing/me`, which is the API's own view. */
export interface LenderCapacity {
  plan: {
    key: string;
    name: string;
    includedClients: number;
    pricePerExtraClientMinor: string;
    pricePerExtraClient: string;
    interval: string;
  };
  status: string;
  slotsExpireAt: string | null;
  capacity: {
    capacity: number;
    used: number;
    remaining: number;
    canAddClient: boolean;
    atLimit: boolean;
    blocked: boolean;
    unitPriceMinor: string;
    unitPrice: string;
  };
}

export type CapacityState =
  | { kind: 'loading' }
  | { kind: 'unknown' }
  | { kind: 'ready'; cap: LenderCapacity };

/**
 * Client capacity for the signed-in lender, read from the API rather than
 * counted in the browser.
 *
 * The UI deliberately mirrors the server's answer instead of deriving it: the
 * free floor, any per-lender promotion and the paid-slot window are all
 * server-owned, so a client-side count would disagree with the gate the moment
 * either changed. This is a hint for the user, never the enforcement — invites
 * are still rejected server-side with 402 `CLIENT_LIMIT`.
 */
export function useLenderCapacity(): [
  CapacityState,
  () => void,
] {
  const [state, setState] = useState<CapacityState>({ kind: 'loading' });

  const load = useCallback(() => {
    api
      .get<LenderCapacity>('/billing/me')
      .then((r) => setState({ kind: 'ready', cap: r.data }))
      // A lender with no subscription row yet, or an API that is down, must not
      // block the clients list. Fall back to "don't know" and stay quiet.
      .catch(() => setState({ kind: 'unknown' }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return [state, load];
}
