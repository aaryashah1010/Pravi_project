import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Link, useParams } from 'react-router-dom';
import type { InspectionDto } from '@infraflow/shared';
import { useAuth } from '@/lib/auth';
import { useInspection, useMilestones, useSubmitInspection, useUploadEvidence, type InspectionSubmitBody } from '@/lib/queries';
import { errorMessage, ApiError } from '@/lib/api';
import { formatDate, humanize } from '@/lib/format';
import { Page } from '@/components/shell/AppShell';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CodeTag } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Overlay';
import { EmptyState, ErrorNotice, InfoBanner, SkeletonRows } from '@/components/ui/States';
import { TextAreaField, TextInput } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';
import { EvidenceGrid, InspectionDetailBody } from './InspectionDetail';

type ItemResult = 'PASS' | 'FAIL' | 'NA' | 'OBSERVATION';
type OverallResult = 'PASS' | 'FAIL' | 'OBSERVATION';

const ITEM_OPTIONS: { value: ItemResult; label: string; on: string }[] = [
  { value: 'PASS', label: 'Pass', on: 'border-emerald-600 bg-emerald-600 text-white' },
  { value: 'FAIL', label: 'Fail', on: 'border-red-600 bg-red-600 text-white' },
  { value: 'OBSERVATION', label: 'Observe', on: 'border-amber-500 bg-amber-500 text-white' },
  { value: 'NA', label: 'N/A', on: 'border-slate-600 bg-slate-600 text-white' },
];

const RESULT_OPTIONS: { value: OverallResult; label: string; icon: string; on: string }[] = [
  { value: 'PASS', label: 'Pass', icon: 'check_circle', on: 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600' },
  { value: 'OBSERVATION', label: 'Observation', icon: 'visibility', on: 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500' },
  { value: 'FAIL', label: 'Fail', icon: 'cancel', on: 'border-red-600 bg-red-50 text-red-900 ring-2 ring-red-600' },
];

const num = (s: string): number | null => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s));

function InspectionForm({ insp, verifiedNow }: { insp: InspectionDto; verifiedNow: number }) {
  const toast = useToast();
  const submit = useSubmitInspection(insp.id);
  const upload = useUploadEvidence(insp.projectId, insp.id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [answers, setAnswers] = useState<Record<string, { result: ItemResult | null; notes: string }>>(() =>
    Object.fromEntries(insp.checklistSchema.map((c) => [c.code, { result: null, notes: '' }])),
  );
  const [result, setResult] = useState<OverallResult | null>(null);
  const [observations, setObservations] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(verifiedNow);
  const [mRef, setMRef] = useState('');
  const [mQty, setMQty] = useState('');
  const [mUnit, setMUnit] = useState('');
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [confirming, setConfirming] = useState(false);

  const values = Object.values(answers);
  const answered = values.filter((a) => a.result !== null).length;
  const anyFail = values.some((a) => a.result === 'FAIL');
  const anyObs = values.some((a) => a.result === 'OBSERVATION');
  const suggested: OverallResult | null = answered < values.length ? null : anyFail ? 'FAIL' : anyObs ? 'OBSERVATION' : 'PASS';
  const effective = result ?? suggested;
  const latN = num(lat);
  const lonN = num(lon);
  const hasGeo = latN !== null && lonN !== null && Math.abs(latN) <= 90 && Math.abs(lonN) <= 180;

  const err = (field: string) => errors.find((e) => e.field === field)?.message;

  const captureLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoMsg('This browser has no location support — enter the coordinates manually.');
      return;
    }
    setGeoBusy(true);
    setGeoMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
        setAccuracy(Math.round(pos.coords.accuracy));
        setGeoBusy(false);
      },
      (e) => {
        setGeoBusy(false);
        setGeoMsg(e.code === e.PERMISSION_DENIED ? 'Location permission was denied. Allow it in the browser, or enter the coordinates manually.' : 'Could not read the device location. Try again or enter the coordinates manually.');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.notify(`${file.name} is not an image.`, 'error');
        continue;
      }
      try {
        await upload.mutateAsync({ file, title: `${insp.milestoneName ?? 'Inspection'} — site photo`, ...(hasGeo ? { latitude: latN!, longitude: lonN! } : {}) });
      } catch (e) {
        toast.notify(`${file.name}: ${errorMessage(e)}`, 'error');
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const validate = (): boolean => {
    const found: { field: string; message: string }[] = [];
    if (answered < values.length) found.push({ field: 'checklist', message: `Answer every checklist item (${values.length - answered} left).` });
    if (!effective) found.push({ field: 'result', message: 'Choose an overall result.' });
    if (effective === 'PASS' && anyFail) found.push({ field: 'result', message: 'A passing inspection cannot contain failed checklist items.' });
    if (effective && effective !== 'PASS' && !observations.trim()) found.push({ field: 'observations', message: 'Observations are required for a fail or observation result.' });
    if ((lat.trim() !== '' || lon.trim() !== '') && !hasGeo) found.push({ field: 'geo', message: 'Enter a valid latitude (−90 to 90) and longitude (−180 to 180), or clear both.' });
    if (effective !== 'FAIL' && progress < verifiedNow) found.push({ field: 'progress', message: `Verified progress cannot go below the current ${verifiedNow}%.` });
    const hasM = mRef.trim() || mQty.trim() || mUnit.trim();
    if (hasM && (!mRef.trim() || num(mQty) === null || (num(mQty) ?? -1) < 0 || !mUnit.trim())) found.push({ field: 'measurement', message: 'A measurement needs a reference, a non-negative quantity and a unit.' });
    setErrors(found);
    return found.length === 0;
  };

  const buildBody = (): InspectionSubmitBody => ({
    result: effective!,
    observations: observations.trim() || undefined,
    ...(hasGeo ? { latitude: latN!, longitude: lonN! } : {}),
    checklist: insp.checklistSchema.map((c) => ({ itemCode: c.code, result: answers[c.code]!.result!, notes: answers[c.code]!.notes.trim() || undefined })),
    ...(effective !== 'FAIL' && progress > verifiedNow ? { verifiedProgress: progress } : {}),
    ...(mRef.trim() && mUnit.trim() && num(mQty) !== null ? { measurement: { reference: mRef.trim(), quantity: num(mQty)!, unit: mUnit.trim() } } : {}),
  });

  const doSubmit = () => {
    submit.mutate(buildBody(), {
      onSuccess: (r) => {
        setConfirming(false);
        toast.notify(r.result === 'FAIL' ? 'Inspection recorded as FAIL. An issue was raised and the milestone is blocked.' : `Inspection recorded as ${humanize(r.result)}.`, r.result === 'FAIL' ? 'error' : 'success');
      },
      onError: (e) => {
        setConfirming(false);
        if (e instanceof ApiError && e.fieldErrors.length) setErrors(e.fieldErrors.map((f) => ({ field: f.field.split('.')[0]!, message: f.message })));
        toast.notify(errorMessage(e), 'error');
      },
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader
          title="Checklist"
          icon="checklist"
          subtitle={`${insp.templateName ?? 'Inspection template'} · ${answered} of ${values.length} answered`}
        />
        <CardBody className="space-y-3">
          {insp.checklistSchema.map((c, idx) => {
            const a = answers[c.code]!;
            return (
              <fieldset key={c.code} className={clsx('rounded-lg border p-3', a.result === 'FAIL' ? 'border-red-300 bg-red-50/40' : 'border-slate-200')}>
                <legend className="px-1 text-label-lg text-on-surface">{idx + 1}. {c.label}</legend>
                <div className="mt-1 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={c.label}>
                  {ITEM_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={a.result === o.value}
                      onClick={() => setAnswers((s) => ({ ...s, [c.code]: { ...s[c.code]!, result: o.value } }))}
                      className={clsx('min-h-11 rounded border px-2 text-label-lg transition-colors', a.result === o.value ? o.on : 'border-slate-300 bg-white text-on-surface-variant hover:bg-slate-50')}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {a.result === 'FAIL' || a.result === 'OBSERVATION' ? (
                  <input
                    aria-label={`Note for ${c.label}`}
                    placeholder="What did you see? (optional)"
                    value={a.notes}
                    onChange={(e) => setAnswers((s) => ({ ...s, [c.code]: { ...s[c.code]!, notes: e.target.value } }))}
                    className="mt-2 h-10 w-full rounded border border-slate-300 px-3 text-body-md"
                  />
                ) : null}
              </fieldset>
            );
          })}
          {err('checklist') ? <p role="alert" className="text-body-sm text-red-700">{err('checklist')}</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Location" icon="location_on" subtitle="Recorded with the inspection and stamped on each photo you attach" />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Button icon="my_location" loading={geoBusy} onClick={captureLocation} className="min-h-11">Capture current location</Button>
            <TextInput label="Latitude" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} wrapperClassName="w-40" />
            <TextInput label="Longitude" type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} wrapperClassName="w-40" />
          </div>
          {accuracy != null ? <p className="text-body-sm text-on-surface-variant">Device reported ±{accuracy} m accuracy.</p> : null}
          {geoMsg ? <p role="alert" className="text-body-sm text-amber-800">{geoMsg}</p> : null}
          {err('geo') ? <p role="alert" className="text-body-sm text-red-700">{err('geo')}</p> : null}
          {!hasGeo ? <p className="text-body-sm text-on-surface-variant">Without coordinates the record and photos are saved without a geo-tag.</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Photo evidence" icon="photo_camera" subtitle="Each file is hashed (SHA-256) on upload and linked to this inspection" />
        <CardBody className="space-y-3">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="sr-only" id="evidence-input" onChange={(e) => void onFiles(e.target.files)} />
          <label htmlFor="evidence-input" className={clsx('inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-4 text-label-lg text-on-surface hover:bg-slate-50 focus-within:ring-2 focus-within:ring-secondary', upload.isPending && 'pointer-events-none opacity-60')}>
            <Icon name="add_a_photo" className="text-[18px]" />
            {upload.isPending ? 'Uploading…' : 'Take or attach photos'}
          </label>
          {insp.evidence.length ? <EvidenceGrid items={insp.evidence} /> : <p className="text-body-sm text-on-surface-variant">No photos attached yet.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Result" icon="rule" subtitle={suggested ? `Suggested from your checklist: ${humanize(suggested)}` : 'Answer the checklist to get a suggestion'} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Overall result">
            {RESULT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={effective === o.value}
                onClick={() => setResult(o.value)}
                className={clsx('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 text-label-lg transition-colors', effective === o.value ? o.on : 'border-slate-300 bg-white text-on-surface-variant hover:bg-slate-50')}
              >
                <Icon name={o.icon} className="text-[22px]" />
                {o.label}
              </button>
            ))}
          </div>
          {err('result') ? <p role="alert" className="text-body-sm text-red-700">{err('result')}</p> : null}

          <TextAreaField
            label={effective && effective !== 'PASS' ? 'Observations (required)' : 'Observations'}
            rows={4}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            error={err('observations')}
            placeholder="Describe what you found on site…"
          />

          {effective !== 'FAIL' ? (
            <div>
              <label htmlFor="verified-progress" className="text-label-md text-on-surface-variant">Verified progress for this milestone</label>
              <div className="flex items-center gap-3">
                <input id="verified-progress" type="range" min={verifiedNow} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-primary" />
                <span className="w-14 text-right font-code-tabular text-headline-md text-primary">{progress}%</span>
              </div>
              <p className="text-body-sm text-on-surface-variant">Currently verified at {verifiedNow}%. Only an inspector can raise this figure; it can never go down. Leave it unchanged to record no progress.</p>
              {err('progress') ? <p role="alert" className="text-body-sm text-red-700">{err('progress')}</p> : null}
            </div>
          ) : (
            <InfoBanner tone="rose" icon="report_problem">
              A failed inspection records no verified progress. It automatically raises a high-severity quality issue that blocks this milestone until it is resolved and re-inspected.
            </InfoBanner>
          )}

          <details className="rounded border border-slate-200 p-3">
            <summary className="cursor-pointer text-label-lg text-on-surface">Add a measurement (optional)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <TextInput label="Reference" value={mRef} onChange={(e) => setMRef(e.target.value)} placeholder="e.g. Column C4 height" />
              <TextInput label="Quantity" type="number" min={0} step="any" value={mQty} onChange={(e) => setMQty(e.target.value)} />
              <TextInput label="Unit" value={mUnit} onChange={(e) => setMUnit(e.target.value)} placeholder="m, m², m³…" />
            </div>
            {err('measurement') ? <p role="alert" className="mt-2 text-body-sm text-red-700">{err('measurement')}</p> : null}
          </details>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white/95 p-3 shadow-lg backdrop-blur">
        <span className="text-body-sm text-on-surface-variant">{answered}/{values.length} checklist items · {insp.evidence.length} photo{insp.evidence.length === 1 ? '' : 's'}</span>
        <Button variant="primary" icon="send" className="min-h-11" onClick={() => validate() && setConfirming(true)}>Review &amp; submit</Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Submit this inspection?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Go back</Button>
            <Button variant={effective === 'FAIL' ? 'danger' : 'primary'} icon="send" loading={submit.isPending} onClick={doSubmit}>Submit as {effective ? humanize(effective) : ''}</Button>
          </>
        }
      >
        <div className="space-y-2 text-body-md">
          <p>Once submitted, the result is final and appears in the audit log under your name and position.</p>
          <ul className="list-disc space-y-1 pl-5 text-on-surface-variant">
            <li>{values.length} checklist items ({values.filter((a) => a.result === 'FAIL').length} failed, {values.filter((a) => a.result === 'OBSERVATION').length} observations)</li>
            <li>{insp.evidence.length} photo{insp.evidence.length === 1 ? '' : 's'} attached · {hasGeo ? 'geo-tagged' : 'no location recorded'}</li>
            {effective !== 'FAIL' && progress > verifiedNow ? <li>Verified progress {verifiedNow}% → {progress}%</li> : null}
            {effective === 'FAIL' ? <li className="font-medium text-red-800">A quality issue will be raised and this milestone will be blocked.</li> : null}
          </ul>
        </div>
      </Modal>
    </div>
  );
}

export function InspectionPage() {
  const { id: projectId, iid } = useParams<{ id: string; iid: string }>();
  const { can } = useAuth();
  const q = useInspection(iid);
  const milestones = useMilestones(projectId);

  if (q.isLoading) return <Page><SkeletonRows rows={8} /></Page>;
  if (q.isError) return <Page><ErrorNotice error={q.error} onRetry={() => q.refetch()} /></Page>;
  const insp = q.data;
  if (!insp) return <Page><EmptyState icon="search_off" title="Inspection not found" /></Page>;

  const milestone = milestones.data?.find((m) => m.code === insp.milestoneCode);
  const pending = insp.result === 'PENDING';
  const editable = pending && insp.canSubmit && can('inspection.submit');
  const back = `/projects/${insp.projectId}?tab=inspections`;

  return (
    <Page>
      <nav className="flex items-center gap-1 text-body-sm text-on-surface-variant" aria-label="Breadcrumb">
        <Link to="/projects" className="text-secondary hover:underline">Projects</Link>
        <Icon name="chevron_right" className="text-[16px]" />
        <Link to={`/projects/${insp.projectId}`} className="text-secondary hover:underline"><CodeTag>{insp.projectCode}</CodeTag></Link>
        <Icon name="chevron_right" className="text-[16px]" />
        <Link to={back} className="text-secondary hover:underline">Inspections</Link>
      </nav>

      <PageHeader
        title={insp.milestoneName ?? 'Inspection'}
        subtitle={`${insp.templateName ?? 'Inspection'} · requested ${formatDate(insp.requestedAt)}${insp.inspectedAt ? ` · inspected ${formatDate(insp.inspectedAt)}` : ''}`}
        actions={<LinkButton to={back} icon="arrow_back">All inspections</LinkButton>}
      />

      {editable ? (
        <>
          {milestone ? (
            <InfoBanner tone="blue" icon="flag">
              {milestone.name}: planned {milestone.plannedProgress}%, contractor-reported {milestone.reportedProgress}%, verified {milestone.verifiedProgress}%. Reported progress is advisory; only your verified figure counts.
            </InfoBanner>
          ) : null}
          <InspectionForm insp={insp} verifiedNow={milestone?.verifiedProgress ?? 0} />
        </>
      ) : (
        <div className="mx-auto max-w-3xl space-y-3">
          {pending ? (
            <InfoBanner tone="amber" icon="hourglass_top">
              This inspection is waiting for the assigned inspector{insp.inspector?.designation ? ` (${insp.inspector.designation})` : ''}. Only the holder of that position can submit it.
            </InfoBanner>
          ) : null}
          {insp.raisedIssueId ? (
            <InfoBanner tone="rose" icon="report_problem">
              This failed inspection raised a quality issue that blocks the milestone. See the <Link className="underline" to={`/projects/${insp.projectId}?tab=issues`}>Issues tab</Link>.
            </InfoBanner>
          ) : null}
          <Card>
            <CardBody><InspectionDetailBody i={insp} /></CardBody>
          </Card>
        </div>
      )}
    </Page>
  );
}
