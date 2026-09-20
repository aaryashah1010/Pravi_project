# 10 — Contractor and Procurement

## Existing-system integration principle

Gujarat already operates an eProcurement platform. GIL states that the platform supports electronic tendering/e-auction and is used for tenders across many Gujarat government departments and organizations.

Therefore InfraFlow should not rebuild an entire tender portal for the prototype.

## Our role

Store/reference:

- procurement reference ID;
- tender status;
- publication date;
- submission deadline;
- evaluation status;
- award reference;
- contract reference;
- external URL/API identifier where integration is available.

## Contractor access

Contractors should have project-scoped access only.

They can:

- view assigned project/work package;
- view contractual milestone requirements;
- submit progress;
- submit documents;
- respond to observations;
- submit inspection requests;
- submit variation/issue requests where configured.

They cannot:

- approve government sanctions;
- modify authority rules;
- view confidential internal notes;
- view unrelated projects.

## Tender status synchronization

Use an adapter interface:

```ts
interface ProcurementAdapter {
  getTenderStatus(externalTenderId: string): Promise<ExternalTenderStatus>;
  getAward(externalTenderId: string): Promise<ExternalAward | null>;
}
```

For the prototype, implement `MockProcurementAdapter` plus a clear integration boundary.

## Contract

Track:

- contract ID;
- contractor;
- award value;
- contract date;
- commencement date;
- completion date;
- performance security reference;
- DLP terms;
- contract documents;
- milestone/payment terms.

Do not hard-code one universal performance-security percentage or DLP duration. These are contract/procurement-specific and must come from the applicable contract/rule.
