import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkflowNodeDto } from '@infraflow/shared';
import { DOCUMENT_TYPES } from '@/lib/labels';
import { formatBytes } from '@/lib/format';
import { useUploadDocument, useWorkflow } from '@/lib/queries';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FormField, SelectField, inputClass } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';
import { ErrorNotice } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.txt,.doc,.docx,.xls,.xlsx';

interface UploadDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  defaultDocType?: string;
  defaultNodeCode?: string;
}

function requiredTypes(nodes: WorkflowNodeDto[] | undefined): { code: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const n of nodes ?? []) for (const d of n.requiredDocuments) if (!seen.has(d.documentTypeCode)) seen.set(d.documentTypeCode, d.name);
  return [...seen.entries()].map(([code, name]) => ({ code, name }));
}

export function UploadDialog({ projectId, open, onClose, defaultDocType, defaultNodeCode }: UploadDialogProps) {
  const wf = useWorkflow(projectId, open);
  const upload = useUploadDocument(projectId);
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState(defaultDocType ?? '');
  const [nodeCode, setNodeCode] = useState(defaultNodeCode ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDocType(defaultDocType ?? '');
      setNodeCode(defaultNodeCode ?? '');
      setFile(null);
      setLocalError(null);
      upload.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDocType, defaultNodeCode]);

  const nodes = wf.data?.nodes;
  const required = useMemo(() => requiredTypes(nodes), [nodes]);
  const requiredCodes = new Set(required.map((r) => r.code));
  const others = DOCUMENT_TYPES.filter((d) => !requiredCodes.has(d.code));
  const matchingNodes = useMemo(() => (nodes ?? []).filter((n) => n.requiredDocuments.some((d) => d.documentTypeCode === docType)), [nodes, docType]);

  // When the chosen document type is needed by exactly one step, link it automatically.
  useEffect(() => {
    if (!nodeCode && matchingNodes.length === 1) setNodeCode(matchingNodes[0]!.nodeCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType, matchingNodes.length]);

  const onPick = (f: File | null) => {
    setLocalError(null);
    if (f && f.size > MAX_BYTES) {
      setLocalError(`File is ${formatBytes(f.size)}; the limit is 15 MB.`);
      setFile(null);
      return;
    }
    if (f && f.size === 0) {
      setLocalError('The selected file is empty.');
      setFile(null);
      return;
    }
    setFile(f);
  };

  const submit = () => {
    if (!docType || !file) return;
    upload.mutate(
      { documentTypeCode: docType, nodeCode: nodeCode || undefined, file },
      {
        onSuccess: () => {
          notify('Document uploaded.');
          onClose();
        },
      },
    );
  };

  const fieldError = (name: string) => (upload.error instanceof ApiError ? upload.error.fieldErrors.find((f) => f.field === name)?.message : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload document"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="upload" loading={upload.isPending} disabled={!docType || !file} onClick={submit}>
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SelectField label="Document type" required value={docType} onChange={(e) => { setDocType(e.target.value); setNodeCode(''); }} error={fieldError('documentTypeCode')}>
          <option value="">Select a document type</option>
          {required.length > 0 ? (
            <optgroup label="Required by this workflow">
              {required.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label={required.length > 0 ? 'Other document types' : 'Document types'}>
            {others.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </optgroup>
        </SelectField>

        <SelectField
          label="Linked workflow step"
          value={nodeCode}
          onChange={(e) => setNodeCode(e.target.value)}
          hint="Linking marks the step's requirement as submitted."
          error={fieldError('nodeCode')}
          disabled={!wf.data}
        >
          <option value="">Not linked to a step</option>
          {matchingNodes.length > 0 ? (
            <optgroup label="Steps that require this document">
              {matchingNodes.map((n) => (
                <option key={n.nodeCode} value={n.nodeCode}>
                  {n.name} ({n.nodeCode})
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="All steps">
            {(nodes ?? [])
              .filter((n) => !matchingNodes.includes(n))
              .map((n) => (
                <option key={n.nodeCode} value={n.nodeCode}>
                  {n.name} ({n.nodeCode})
                </option>
              ))}
          </optgroup>
        </SelectField>

        <FormField label="File" required htmlFor="upload-file" error={localError ?? fieldError('file')} hint="PDF, image, Word or Excel, up to 15 MB.">
          <input
            id="upload-file"
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            className={`${inputClass} h-auto py-1.5 file:mr-3 file:rounded file:border-0 file:bg-surface-container file:px-3 file:py-1 file:text-body-sm file:font-semibold file:text-primary`}
          />
        </FormField>
        {file ? (
          <p className="text-body-sm text-on-surface-variant">
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : null}
        {upload.isError ? <ErrorNotice error={upload.error} /> : null}
      </div>
    </Modal>
  );
}
