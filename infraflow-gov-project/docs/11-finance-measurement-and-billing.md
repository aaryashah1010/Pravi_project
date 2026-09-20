# 11 — Finance, Measurement and Billing

## Principles

Physical progress, measurement, billing and payment are related but different states.

```text
Physical work
    ↓
Measurement
    ↓
Technical verification
    ↓
Bill
    ↓
Financial processing
    ↓
Payment
```

## Measurement object

```text
Measurement
- id
- project_id
- contract_id
- work_item_id
- quantity
- unit
- measurement_reference
- measured_by
- verified_by
- measured_at
- evidence_id
- status
```

## Bill object

```text
Bill
- id
- contract_id
- measurement_set_id
- gross_amount
- deductions
- net_amount
- submitted_at
- technically_verified_at
- financial_status
- payment_reference
```

## Financial dashboard

Show at least:

- approved/project estimate;
- contract value;
- work value measured;
- bill value submitted;
- bill value verified;
- amount paid;
- remaining contract value;
- variation impact.

## No invented accounting rules

The prototype must not invent:

- deduction percentages;
- tax treatment;
- retention rules;
- payment approval thresholds;
- authority limits.

Those are sourced/configured separately when we obtain the relevant financial and contract rules.

## Source alignment

Official Gujarat technical specifications mention computerized bill formats and computerized measurement books among site documents. This supports the domain model, but actual billing workflow/financial authority must be tied to applicable financial/procurement rules.
