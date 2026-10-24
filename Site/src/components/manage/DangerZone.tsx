'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Trash2 } from 'lucide-react';

export function DangerZone({ serverId, name }: { serverId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/servers/${serverId}`, { method: 'DELETE' });
    if (res.ok) router.push('/dashboard');
    else setBusy(false);
  }

  return (
    <section className="mt-12 rounded-2xl border border-danger/25 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">Delete listing</h2>
          <p className="mt-1 text-sm text-ink-3">Takes the page down and wipes its stats. Your Yapin’ server isn’t touched.</p>
        </div>
        {!confirming && (
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
            <Trash2 size={15} /> Delete
          </button>
        )}
      </div>
      <AnimatePresence>
        {confirming && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="pt-5 flex flex-col sm:flex-row gap-2">
              <input className="field flex-1" placeholder={`Type “${name}” to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" disabled={typed !== name || busy} onClick={remove}>
                {busy ? 'Deleting…' : 'Delete for good'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
