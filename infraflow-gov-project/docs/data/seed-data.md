# Seed Data

All seed data is synthetic.

## Organizations

```json
[
  {"code":"DEMO-EDU","name":"Demo Education Department","type":"DEPARTMENT"},
  {"code":"DEMO-RNB","name":"Demo Engineering Organization","type":"ENGINEERING_ORG"}
]
```

## Offices

```json
[
  {"code":"DEMO-AHM-HQ","name":"Demo Ahmedabad District Office","type":"DISTRICT","jurisdiction":"DEMO-AHMEDABAD"},
  {"code":"DEMO-TAL-01","name":"Demo Taluka Office","type":"TALUKA","jurisdiction":"DEMO-TALUKA-01"},
  {"code":"DEMO-DIV-01","name":"Demo Engineering Division","type":"DIVISION","jurisdiction":"DEMO-DIVISION-01"}
]
```

## Positions

```json
[
  {"designation":"Project Officer","office":"DEMO-AHM-HQ"},
  {"designation":"Technical Engineer","office":"DEMO-DIV-01"},
  {"designation":"Competent Authority","office":"DEMO-AHM-HQ"},
  {"designation":"Monitoring Officer","office":"DEMO-AHM-HQ"},
  {"designation":"Field Inspector","office":"DEMO-DIV-01"}
]
```

## Demo project

```json
{
  "project_code":"DEMO-INF-0001",
  "name":"Demo Government School Building",
  "project_type":"GOVERNMENT_BUILDING",
  "department":"DEMO-EDU",
  "owning_office":"DEMO-AHM-HQ",
  "location":{
    "district":"DEMO-AHMEDABAD",
    "taluka":"DEMO-TALUKA-01"
  },
  "estimated_cost":120000000,
  "currency":"INR",
  "is_demo":true
}
```

## Demo warning

Every UI page showing seed data should include a small `DEMO DATA` label. No synthetic approval decision or synthetic officer name should be represented as a real government record.
