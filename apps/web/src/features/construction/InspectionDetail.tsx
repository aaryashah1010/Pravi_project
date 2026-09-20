import { useEffect, useState } from 'react';
import type { InspectionDto } from '@infraflow/shared';
import { downloadFile, errorMessage, fetchBlobUrl } from '@/lib/api';
import { formatDate, humanize } from '@/lib/format';
import type { Tone } from '@/lib/labels';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { TABLE, THEAD, TH, TR, TD, TD_MONO } from '@/components/ui/table';

export function resultTone(result: string): Tone {
  switch (result) {
    case 'PASS': return 'emerald';
    case 'FAIL': return 'rose';
    case 'OBSERVATION': return 'amber';
    case 'PENDING': return 'blue';
    default: return 'slate';
  }
}

export function resultIcon(result: string): string {
  switch (result) {
    case 'PASS': return 'check_circle';
    case 'FAIL': return 'cancel';
    case 'OBSERVATION': return 'visibility';
    case 'PENDING': return 'schedule';
    default: return 'help';
  }
}

type Evidence = InspectionDto['evidence'][number];

function EvidenceThumb({ e }: { e: Evidence }) {
  const toast = useToast();
  const [src, setSrc] = useState<string | null>(null);
  const isImage = e.mimeType.startsWith('image/') && e.mimeType !== 'image/heic';

  useEffect(() => {
    if (!isImage) return;
    const ctl = new AbortController();
    let url: string | null = null;
    fetchBlobUrl(`/documents/${e.documentId}/download`, ctl.signal)
      .then((u) => {
        url = u;
        if (ctl.signal.aborted) URL.revokeObjectURL(u);
        else setSrc(u);
      })
      .catch(() => setSrc(null));
    return () => {
      ctl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [e.documentId, isImage]);

  return (
    <figure className="overflow-hidden rounded border border-slate-200 bg-surface-container-lowest">
      <div className="grid h-28 place-items-center bg-slate-100">
        {src ? <img src={src} alt={e.title} className="h-full w-full object-cover" /> : <Icon name={isImage ? 'image' : 'description'} className="text-[28px] text-outline" />}
      </div>
      <figcaption className="space-y-0.5 p-2 text-body-sm">
        <div className="truncate font-medium text-on-surface" title={e.title}>{e.title}</div>
        <div className="text-on-surface-variant">{formatDate(e.uploadedAt)}</div>
        {e.latitude != null && e.longitude != null ? (
          <div className="flex items-center gap-1 font-code-sm text-on-surface-variant" title="GPS captured with the photo">
            <Icon name="location_on" className="text-[14px]" />{e.latitude.toFixed(5)}, {e.longitude.toFixed(5)}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-amber-700"><Icon name="location_off" className="text-[14px]" />No GPS on this photo</div>
        )}
        <div className="font-code-sm text-outline" title={`SHA-256 ${e.sha256}`}>sha256 {e.sha256.slice(0, 12)}…</div>
        <Button size="sm" icon="download" className="mt-1" onClick={() => void downloadFile(`/documents/${e.documentId}/download`, e.title).catch((err: unknown) => toast.notify(errorMessage(err), 'error'))}>Download</Button>
      </figcaption>
    </figure>
  );
}

export function EvidenceGrid({ items }: { items: Evidence[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((e) => <EvidenceThumb key={e.documentId} e={e} />)}
    </div>
  );
}

/** Read-only view of a submitted (or pending) inspection. */
export function InspectionDetailBody({ i }: { i: InspectionDto }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={resultTone(i.result)} label={humanize(i.result)} icon={resultIcon(i.result)} />
        {i.raisedIssueId ? <Badge tone="rose" label="Issue raised" icon="report_problem" /> : null}
      </div>

      {i.inspector ? (
        <div>
          <span className="text-label-md text-on-surface-variant">Inspector</span>
          <div className="text-body-md">{i.inspector.holderName ?? <span className="text-amber-700">Seat vacant</span>} · <span className="text-on-surface-variant">{i.inspector.designation}</span></div>
        </div>
      ) : null}

      {i.observations ? (
        <div>
          <span className="text-label-md text-on-surface-variant">Observations</span>
          <p className="mt-0.5 whitespace-pre-line text-body-md">{i.observations}</p>
        </div>
      ) : null}

      {i.latitude && i.longitude ? (
        <div>
          <span className="text-label-md text-on-surface-variant">Recorded location</span>
          <div className="font-code-sm text-body-md">{i.latitude}, {i.longitude}</div>
        </div>
      ) : null}

      {i.checklistResults.length > 0 ? (
        <div>
          <span className="text-label-md text-on-surface-variant">Checklist</span>
          <div className="mt-1 space-y-1">
            {i.checklistResults.map((c) => (
              <div key={c.itemCode} className="flex items-start gap-2 rounded bg-surface-container px-3 py-1.5 text-body-sm">
                <Icon name={resultIcon(c.result)} className={`text-[16px] ${c.result === 'PASS' ? 'text-emerald-600' : c.result === 'FAIL' ? 'text-red-600' : 'text-amber-600'}`} />
                <div className="min-w-0 flex-1">
                  <div>{c.label || c.itemCode}</div>
                  {c.notes ? <div className="text-on-surface-variant">{c.notes}</div> : null}
                </div>
                <Badge tone={resultTone(c.result)} label={c.result} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {i.measurements.length > 0 ? (
        <div>
          <span className="text-label-md text-on-surface-variant">Measurements</span>
          <div className="mt-1 overflow-x-auto rounded border border-slate-200">
            <table className={TABLE}>
              <thead className={THEAD}><tr><th className={TH}>Reference</th><th className={TH}>Quantity</th><th className={TH}>Unit</th><th className={TH}>Status</th></tr></thead>
              <tbody>
                {i.measurements.map((m) => (
                  <tr key={`${m.reference}-${m.quantity}`} className={TR}><td className={TD}>{m.reference}</td><td className={TD_MONO}>{m.quantity}</td><td className={TD}>{m.unit}</td><td className={TD}>{humanize(m.status)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {i.evidence.length > 0 ? (
        <div>
          <span className="text-label-md text-on-surface-variant">Evidence ({i.evidence.length})</span>
          <div className="mt-1"><EvidenceGrid items={i.evidence} /></div>
        </div>
      ) : null}
    </div>
  );
}
