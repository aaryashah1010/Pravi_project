import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreateProjectSchema, POSSESSION_STATUSES, type ProjectDetailDto } from '@infraflow/shared';
import { ApiError } from '@/lib/api';
import { homeOrganizationId, useAuth } from '@/lib/auth';
import { POSSESSION_LABEL } from '@/lib/labels';
import { formatInr, humanize } from '@/lib/format';
import { useCreateProject, useOffices, useOrgReference, useSubmitProject } from '@/lib/queries';
import { Page } from '@/components/shell/AppShell';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Card';
import { SelectField, TextAreaField, TextInput } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { ErrorNotice, InfoBanner, SkeletonRows } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';

type Tri = 'unknown' | 'yes' | 'no';
const MONEY = /^\d{1,16}(\.\d{1,2})?$/;

interface FormState {
  name: string;
  departmentId: string;
  officeId: string;
  jurisdictionId: string;
  cost: string;
  addressLine: string;
  city: string;
  district: string;
  taluka: string;
  landOwner: string;
  possession: string;
  latitude: string;
  longitude: string;
  justification: string;
  fundingNotes: string;
  localBody: Tri;
}

const EMPTY: FormState = {
  name: '',
  departmentId: '',
  officeId: '',
  jurisdictionId: '',
  cost: '',
  addressLine: '',
  city: '',
  district: '',
  taluka: '',
  landOwner: '',
  possession: '',
  latitude: '',
  longitude: '',
  justification: '',
  fundingNotes: '',
  localBody: 'unknown',
};

type Errors = Record<string, string>;

function buildPayload(f: FormState): { payload: Record<string, unknown>; errors: Errors } {
  const errors: Errors = {};
  const site: Record<string, unknown> = {};
  const put = (key: string, v: string) => {
    if (v.trim()) site[key] = v.trim();
  };
  put('addressLine', f.addressLine);
  put('city', f.city);
  put('district', f.district);
  put('taluka', f.taluka);
  put('landOwner', f.landOwner);
  if (f.possession) site.possessionStatus = f.possession;
  if (f.latitude.trim()) {
    const n = Number(f.latitude);
    if (Number.isNaN(n)) errors['site.latitude'] = 'Enter a number between -90 and 90.';
    else site.latitude = n;
  }
  if (f.longitude.trim()) {
    const n = Number(f.longitude);
    if (Number.isNaN(n)) errors['site.longitude'] = 'Enter a number between -180 and 180.';
    else site.longitude = n;
  }
  // "Unknown" means the key is omitted so the local-body clearance stays conditional/pending verification.
  const attributes: Record<string, unknown> = {};
  if (f.localBody === 'yes') attributes.local_body_approval_required = true;
  if (f.localBody === 'no') attributes.local_body_approval_required = false;

  const payload: Record<string, unknown> = {
    name: f.name.trim(),
    projectTypeCode: 'GOV_BUILDING',
    departmentOrganizationId: f.departmentId,
    owningOfficeId: f.officeId,
    estimatedCost: f.cost.trim(),
    attributes,
    site,
    proposal: { justification: f.justification.trim(), ...(f.fundingNotes.trim() ? { fundingNotes: f.fundingNotes.trim() } : {}) },
  };
  if (f.jurisdictionId) payload.primaryJurisdictionId = f.jurisdictionId;
  return { payload, errors };
}

function zodErrors(payload: Record<string, unknown>): Errors {
  const res = CreateProjectSchema.safeParse(payload);
  if (res.success) return {};
  const out: Errors = {};
  for (const issue of res.error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function ProjectCreatePage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const ref = useOrgReference();
  const offices = useOffices();
  const create = useCreateProject();
  const submit = useSubmitProject();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [created, setCreated] = useState<ProjectDetailDto | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Preselect the department the signed-in user belongs to.
  useEffect(() => {
    if (!ref.data || form.departmentId) return;
    const home = homeOrganizationId(me);
    const pick = ref.data.organizations.find((o) => o.id === home) ?? (ref.data.organizations.length === 1 ? ref.data.organizations[0] : undefined);
    if (pick) setForm((f) => ({ ...f, departmentId: pick.id }));
  }, [ref.data, me, form.departmentId]);

  const deptOffices = useMemo(() => (offices.data ?? []).filter((o) => o.organizationId === form.departmentId), [offices.data, form.departmentId]);

  // Default to the office when a department has exactly one; clear a stale office after switching department.
  useEffect(() => {
    if (!form.departmentId) return;
    if (form.officeId && !deptOffices.some((o) => o.id === form.officeId)) setForm((f) => ({ ...f, officeId: '' }));
    else if (!form.officeId && deptOffices.length === 1) setForm((f) => ({ ...f, officeId: deptOffices[0]!.id }));
  }, [deptOffices, form.departmentId, form.officeId]);

  const serverErrors = useMemo<Errors>(() => {
    if (!(create.error instanceof ApiError)) return {};
    const out: Errors = {};
    for (const f of create.error.fieldErrors) out[f.field] = f.message;
    return out;
  }, [create.error]);

  const err = (path: string): string | undefined => errors[path] ?? serverErrors[path] ?? serverErrors[path.split('.').pop() ?? path];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const { payload, errors: local } = buildPayload(form);
    const zod = zodErrors(payload);
    const all = { ...zod, ...local };
    if (!form.departmentId) all.departmentOrganizationId = 'Choose a department.';
    if (!form.officeId) all.owningOfficeId = 'Choose the owning office.';
    if (form.cost.trim() && !MONEY.test(form.cost.trim())) all.estimatedCost = 'Enter a non-negative amount with up to 2 decimals (no commas).';
    setErrors(all);
    if (Object.keys(all).length > 0) return;
    create.mutate(payload, {
      onSuccess: (p) => {
        setCreated(p);
        notify(`Project ${p.code} created.`);
      },
    });
  };

  if (created) {
    return (
      <Page className="max-w-3xl">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Icon name="check_circle" className="text-[26px]" filled />
              </div>
              <div>
                <h1 className="text-headline-lg text-on-surface">Project created</h1>
                <p className="text-body-md text-on-surface-variant">
                  <span className="font-code-tabular text-code-tabular text-primary-container">{created.code}</span> — {created.name} ({formatInr(created.estimatedCost)}) is saved as a draft proposal.
                </p>
              </div>
            </div>
            <InfoBanner icon="account_tree">
              Submitting evaluates the verified rule registry against the project facts, generates the dependency workflow and starts the first tasks. Facts left unknown keep dependent steps as
              “Conditional — pending verification”.
            </InfoBanner>
            {submit.isError ? <ErrorNotice error={submit.error} /> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon="rocket_launch"
                loading={submit.isPending}
                onClick={() =>
                  submit.mutate(created.id, {
                    onSuccess: () => {
                      notify('Workflow generated.');
                      navigate(`/projects/${created.id}?tab=workflow`);
                    },
                  })
                }
              >
                Submit for workflow generation
              </Button>
              <LinkButton to={`/projects/${created.id}`}>Open project without submitting</LinkButton>
              <Button
                variant="ghost"
                onClick={() => {
                  setCreated(null);
                  setForm({ ...EMPTY, departmentId: form.departmentId, officeId: form.officeId });
                  create.reset();
                  submit.reset();
                }}
              >
                Create another
              </Button>
            </div>
          </CardBody>
        </Card>
      </Page>
    );
  }

  const costPreview = MONEY.test(form.cost.trim()) ? formatInr(form.cost.trim()) : null;

  return (
    <Page className="max-w-4xl">
      <Link to="/projects" className="inline-flex items-center gap-1 text-body-md text-secondary hover:underline">
        <Icon name="arrow_back" className="text-[16px]" />
        All projects
      </Link>
      <PageHeader title="New project" subtitle="Enter the project facts. Rules are evaluated against these facts when the project is submitted; nothing is assumed for facts you leave unknown." />

      {ref.isLoading || offices.isLoading ? (
        <SkeletonRows rows={6} />
      ) : ref.isError || offices.isError ? (
        <ErrorNotice error={ref.error ?? offices.error} onRetry={() => { void ref.refetch(); void offices.refetch(); }} />
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Card>
            <CardHeader title="Basics" icon="domain" />
            <CardBody className="grid gap-4 md:grid-cols-2">
              <TextInput label="Project name" required wrapperClassName="md:col-span-2" value={form.name} onChange={(e) => set('name', e.target.value)} error={err('name')} maxLength={200} placeholder="e.g. Primary school block, Taluka office" />
              <SelectField label="Department" required value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} error={err('departmentOrganizationId')}>
                <option value="">Select a department</option>
                {ref.data!.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Owning office" required value={form.officeId} onChange={(e) => set('officeId', e.target.value)} error={err('owningOfficeId')} disabled={!form.departmentId}>
                <option value="">{form.departmentId ? 'Select an office' : 'Choose a department first'}</option>
                {deptOffices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({humanize(o.officeType)})
                  </option>
                ))}
              </SelectField>
              <SelectField label="Jurisdiction" value={form.jurisdictionId} onChange={(e) => set('jurisdictionId', e.target.value)} error={err('primaryJurisdictionId')} hint="Optional. Used to locate the project for authority and clearance rules.">
                <option value="">Not specified</option>
                {ref.data!.jurisdictions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({humanize(j.jurisdiction_type)})
                  </option>
                ))}
              </SelectField>
              <TextInput
                label="Estimated cost (INR)"
                required
                inputMode="decimal"
                value={form.cost}
                onChange={(e) => set('cost', e.target.value)}
                error={err('estimatedCost')}
                placeholder="120000000"
                hint={costPreview ? <span>Shown as <span className="font-code-tabular text-code-tabular">{costPreview}</span></span> : 'Full rupee amount, digits only, up to 2 decimals.'}
              />
              <p className="text-body-sm text-on-surface-variant md:col-span-2">
                Project type: <span className="font-medium text-on-surface">Government Building</span>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Site" icon="location_on" subtitle="All optional. Unknown site facts are recorded as unknown." />
            <CardBody className="grid gap-4 md:grid-cols-2">
              <TextInput label="Address" wrapperClassName="md:col-span-2" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} error={err('site.addressLine')} />
              <TextInput label="City" value={form.city} onChange={(e) => set('city', e.target.value)} error={err('site.city')} />
              <TextInput label="District" value={form.district} onChange={(e) => set('district', e.target.value)} error={err('site.district')} />
              <TextInput label="Taluka" value={form.taluka} onChange={(e) => set('taluka', e.target.value)} error={err('site.taluka')} />
              <TextInput label="Land owner" value={form.landOwner} onChange={(e) => set('landOwner', e.target.value)} error={err('site.landOwner')} />
              <SelectField label="Possession status" value={form.possession} onChange={(e) => set('possession', e.target.value)} error={err('site.possessionStatus')}>
                <option value="">Not specified</option>
                {POSSESSION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {POSSESSION_LABEL[s] ?? humanize(s)}
                  </option>
                ))}
              </SelectField>
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Latitude" inputMode="decimal" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} error={err('site.latitude')} className="font-code-tabular" />
                <TextInput label="Longitude" inputMode="decimal" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} error={err('site.longitude')} className="font-code-tabular" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Proposal and applicability" icon="rule" />
            <CardBody className="grid gap-4 md:grid-cols-2">
              <TextAreaField label="Justification" required wrapperClassName="md:col-span-2" rows={4} value={form.justification} onChange={(e) => set('justification', e.target.value)} error={err('proposal.justification')} hint="Why is this project needed? At least 10 characters." maxLength={4000} />
              <TextAreaField label="Funding notes" wrapperClassName="md:col-span-2" rows={2} value={form.fundingNotes} onChange={(e) => set('fundingNotes', e.target.value)} error={err('proposal.fundingNotes')} maxLength={2000} />
              <SelectField
                label="Local-body approval required"
                value={form.localBody}
                onChange={(e) => set('localBody', e.target.value as Tri)}
                wrapperClassName="md:col-span-2"
                hint="If unknown, the local-body clearance step stays “Conditional — pending verification” until someone confirms the fact."
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </SelectField>
            </CardBody>
          </Card>

          {create.isError ? <ErrorNotice error={create.error} /> : null}
          {Object.keys(errors).length > 0 ? (
            <InfoBanner tone="rose" icon="error">
              Some details need attention. Review the highlighted fields.
            </InfoBanner>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <LinkButton to="/projects">Cancel</LinkButton>
            <Button type="submit" variant="primary" icon="save" loading={create.isPending}>
              Create project
            </Button>
          </div>
        </form>
      )}
    </Page>
  );
}
