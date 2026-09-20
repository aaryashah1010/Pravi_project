import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useDecideApproval, type DecisionAction } from '@/lib/queries';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';
import { ErrorNotice } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';

const MIN_REASON = 5;

const COPY: Record<DecisionAction, { title: string; confirm: string; success: string; required: boolean; variant: 'primary' | 'danger' | 'secondary'; icon: string; hint: string }> = {
  approve: { title: 'Approve', confirm: 'Approve', success: 'Approval approved.', required: false, variant: 'primary', icon: 'verified', hint: 'Optional note recorded in the decision history.' },
  return: { title: 'Return for correction', confirm: 'Return', success: 'Approval returned.', required: true, variant: 'secondary', icon: 'undo', hint: 'Explain what must be corrected. The submitter will see this.' },
  reject: { title: 'Reject', confirm: 'Reject', success: 'Approval rejected.', required: true, variant: 'danger', icon: 'cancel', hint: 'A reason is mandatory and is recorded in the audit trail.' },
  'request-info': { title: 'Request information', confirm: 'Request information', success: 'Information requested.', required: true, variant: 'secondary', icon: 'help', hint: 'State the information that is needed before a decision.' },
};

interface DecisionModalProps {
  approvalId: string;
  action: DecisionAction | null;
  onClose: () => void;
}

export function DecisionModal({ approvalId, action, onClose }: DecisionModalProps) {
  const decide = useDecideApproval();
  const { notify } = useToast();
  const [reason, setReason] = useState('');

  useEffect(() => {
    setReason('');
    decide.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  if (!action) return null;
  const copy = COPY[action];
  const trimmed = reason.trim();
  const valid = copy.required ? trimmed.length >= MIN_REASON : true;
  const reasonError = decide.error instanceof ApiError ? decide.error.fieldErrors.find((f) => f.field === 'reason')?.message : undefined;

  const confirm = () => {
    decide.mutate(
      { id: approvalId, action, reason: trimmed || undefined },
      {
        onSuccess: () => {
          notify(copy.success);
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={copy.variant} icon={copy.icon} loading={decide.isPending} disabled={!valid} onClick={confirm}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextAreaField
          label={copy.required ? 'Reason (required)' : 'Note (optional)'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          autoFocus
          maxLength={2000}
          required={copy.required}
          hint={copy.required ? `${copy.hint} Minimum ${MIN_REASON} characters.` : copy.hint}
          error={reasonError ?? (copy.required && reason.length > 0 && !valid ? `Enter at least ${MIN_REASON} characters.` : undefined)}
        />
        {decide.isError ? <ErrorNotice error={decide.error} onRetry={onClose} /> : null}
      </div>
    </Modal>
  );
}
