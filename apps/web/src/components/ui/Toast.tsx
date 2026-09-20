import clsx from 'clsx';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type ToastTone = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi>({ notify: () => undefined });

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId++;
    setItems((cur) => [...cur, { id, tone, message }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 5000);
  }, []);

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-body-md shadow-lg',
              t.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
              t.tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-900',
              t.tone === 'error' && 'border-red-200 bg-red-50 text-red-900',
            )}
          >
            <Icon name={t.tone === 'error' ? 'error' : t.tone === 'info' ? 'info' : 'check_circle'} className="mt-0.5 text-[18px]" filled />
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))} className="opacity-60 hover:opacity-100">
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
