import { Leva } from 'leva';

/* Leva only powers the dev debug panels — keep it out of the initial bundle. */
export default function DebugLeva() {
  return <Leva collapsed hidden />;
}
