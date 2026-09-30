import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { notifications, type NotificationRow } from '@/lib/api';

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notifications.list(),
    refetchInterval: 30_000,
  });
  const readMut = useMutation({
    mutationFn: (id: string) => notifications.read(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAllMut = useMutation({
    mutationFn: () => notifications.readAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-notif-root]')) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = query.data?.unread_count ?? 0;
  const items = query.data?.items ?? [];

  const handleClick = (n: NotificationRow) => {
    readMut.mutate(n.id);
    if (n.link_path) {
      setOpen(false);
      navigate(n.link_path);
    }
  };

  return (
    <div className="relative" data-notif-root>
      <button
        type="button"
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface"
        aria-label={`Notificações (${unread} não lidas)`}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4 text-brand-cyan" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-black">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[360px] card-strong p-3">
          <header className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Notificações</div>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs text-brand-cyan hover:underline"
                onClick={() => readAllMut.mutate()}
              >
                Marcar todas como lidas
              </button>
            )}
          </header>
          {items.length === 0 ? (
            <p className="p-4 text-center text-xs text-text-secondary">Sem notificações.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-auto">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-lg border border-border p-2 ${n.read_at ? 'opacity-70' : 'bg-brand-blue/10'}`}
                >
                  <button type="button" className="w-full text-left" onClick={() => handleClick(n)}>
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.body && <div className="text-xs text-text-secondary">{n.body}</div>}
                    <div className="mt-1 text-[10px] text-text-muted">
                      {new Date(n.created_at).toLocaleString('pt-BR')}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
