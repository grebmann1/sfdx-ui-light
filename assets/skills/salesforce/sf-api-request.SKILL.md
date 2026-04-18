---
name: sf-api-request
description: Make authenticated Salesforce REST and GraphQL API calls using the sf CLI. Use when the user asks to query or mutate Salesforce data via sf api request rest or sf api request graphql, including composite API patterns, batch requests, sObject CRUD, and Postman-style JSON files.
---

# sf api request

Both subcommands are **beta**. Always include `-o <alias>` unless `target-org` is already configured.

---

## sf api request rest

```
sf api request rest [URL] -o <alias> [-X METHOD] [-H key:value] [-b body|-f file] [-i] [-S output.xlsx]
```

| Flag | Purpose |
|------|---------|
| `-X` | HTTP method (GET POST PUT PATCH DELETE …) — default GET |
| `-H` | Header, repeatable: `-H 'Accept: application/xml'` |
| `-b` | Inline body string or `@filename.json` for a file |
| `-f` | Postman-style JSON file (url + method + header + body) |
| `-i` | Print response status + headers |
| `-S` | Stream response to file (e.g. binary/xlsx downloads) |

### CRUD examples

```bash
# GET — list org limits
sf api request rest 'services/data/v62.0/limits' -o myOrg

# GET — query via REST (SOQL)
sf api request rest "services/data/v62.0/query?q=SELECT+Id,Name+FROM+Account+LIMIT+5" -o myOrg

# POST — create a record (inline body)
sf api request rest services/data/v62.0/sobjects/Account \
  -X POST \
  -b '{"Name":"Acme","ShippingCity":"Paris"}' \
  -o myOrg

# POST — create from file
sf api request rest services/data/v62.0/sobjects/Account \
  -X POST -b @account.json -o myOrg

# PATCH — update a record
sf api request rest "services/data/v62.0/sobjects/Account/<ID>" \
  -X PATCH \
  -b '{"BillingCity":"London"}' \
  -o myOrg

# DELETE — delete a record
sf api request rest "services/data/v62.0/sobjects/Account/<ID>" \
  -X DELETE -o myOrg
```

### --file (Postman JSON) schema

```json
{
  "url": "sobjects/Account/<ID>",
  "method": "PATCH",
  "header": [{"key": "Accept", "value": "application/json"}],
  "body": {
    "mode": "raw",
    "raw": { "BillingCity": "Boise" }
  }
}
```

```bash
sf api request rest -f myRequest.json -o myOrg
```

---

## Composite REST API

The **outer** `sf api request rest` call is always `-X POST` — you are posting a composite envelope to Salesforce. The **inner** `"method"` fields inside the JSON body describe what each subrequest does (GET, POST, PATCH, DELETE).

### Subrequest method quick-reference

| Goal | Inner `"method"` | Inner `"url"` pattern |
|------|------------------|-----------------------|
| Read a record | `GET` | `/services/data/vXX.0/sobjects/SObject/<ID>` |
| Run SOQL | `GET` | `/services/data/vXX.0/query?q=SELECT…` |
| Create a record | `POST` | `/services/data/vXX.0/sobjects/SObject` |
| Update a record | `PATCH` | `/services/data/vXX.0/sobjects/SObject/<ID>` |
| Delete a record | `DELETE` | `/services/data/vXX.0/sobjects/SObject/<ID>` |
| Upsert by ext ID | `PATCH` | `/services/data/vXX.0/sobjects/SObject/ExtField__c/<value>` |

### 1. Composite (chained, dependent)

**Outer**: `-X POST` to `/composite`
**Inner subrequests**: any method; use `@{refId.field}` to pass a prior result's value forward.
Max 25 subrequests. Supports `allOrNone`.

```bash
sf api request rest services/data/v62.0/composite \
  -X POST \
  -b '{
    "allOrNone": true,
    "compositeRequest": [
      {
        "method": "POST",
        "url": "/services/data/v62.0/sobjects/Account",
        "referenceId": "newAcc",
        "body": {"Name": "Cloud Tech Inc"}
      },
      {
        "method": "POST",
        "url": "/services/data/v62.0/sobjects/Contact",
        "referenceId": "newCon",
        "body": {
          "FirstName": "Alex",
          "LastName": "Smith",
          "AccountId": "@{newAcc.id}"
        }
      },
      {
        "method": "GET",
        "url": "/services/data/v62.0/sobjects/Contact/@{newCon.id}",
        "referenceId": "readCon"
      },
      {
        "method": "PATCH",
        "url": "/services/data/v62.0/sobjects/Account/@{newAcc.id}",
        "referenceId": "updateAcc",
        "body": {"Description": "Created with composite"}
      }
    ]
  }' \
  -o myOrg
```

### 2. Composite Batch (independent, up to 25)

**Outer**: `-X POST` to `/composite/batch`
**Inner subrequests**: any method; they run independently (no chaining). Use `haltOnError: true` to stop on first failure.

```bash
sf api request rest services/data/v62.0/composite/batch \
  -X POST \
  -b '{
    "haltOnError": false,
    "batchRequests": [
      {
        "method": "GET",
        "url": "v62.0/sobjects/Account/<ID1>"
      },
      {
        "method": "PATCH",
        "url": "v62.0/sobjects/Contact/<ID2>",
        "richInput": {"Title": "VP Engineering"}
      },
      {
        "method": "DELETE",
        "url": "v62.0/sobjects/Lead/<ID3>"
      }
    ]
  }' \
  -o myOrg
```

> Note: batch subrequest bodies are in `"richInput"`, not `"body"`.

### 3. sObject Tree (parent-child insert)

**Outer**: `-X POST` to `/composite/tree/<ParentSObject>`
**Operation**: always inserts (POST semantics only — no updates or deletes).
Creates a parent and up to 200 nested children in one call.

```bash
sf api request rest services/data/v62.0/composite/tree/Account \
  -X POST \
  -b '{
    "records": [{
      "attributes": {"type": "Account", "referenceId": "acc1"},
      "Name": "Salesforce",
      "Contacts": {
        "records": [
          {
            "attributes": {"type": "Contact", "referenceId": "con1"},
            "LastName": "Doe",
            "Email": "doe@sf.com"
          }
        ]
      }
    }]
  }' \
  -o myOrg
```

### 4. sObject Collections (same type, bulk up to 200)

**Outer**: `-X POST | PATCH | DELETE` — the outer method determines the operation for **all** records.

| Outer `-X` | What it does |
|-----------|-------------|
| `POST` | Create up to 200 records of the same type |
| `PATCH` | Update up to 200 records (each must include `Id`) |
| `DELETE` | Delete up to 200 records (pass `?ids=id1,id2,…` as query param, no body) |

```bash
# Create multiple Accounts
sf api request rest services/data/v62.0/composite/sobjects \
  -X POST \
  -b '{
    "allOrNone": false,
    "records": [
      {"attributes":{"type":"Account"},"Name":"Alpha Corp"},
      {"attributes":{"type":"Account"},"Name":"Beta Ltd"}
    ]
  }' \
  -o myOrg

# Update multiple Accounts (Id required in each record)
sf api request rest services/data/v62.0/composite/sobjects \
  -X PATCH \
  -b '{
    "allOrNone": false,
    "records": [
      {"attributes":{"type":"Account"},"Id":"<ID1>","BillingCity":"Paris"},
      {"attributes":{"type":"Account"},"Id":"<ID2>","BillingCity":"London"}
    ]
  }' \
  -o myOrg

# Delete multiple records (ids in query string, no body needed)
sf api request rest "services/data/v62.0/composite/sobjects?ids=<ID1>,<ID2>,<ID3>&allOrNone=false" \
  -X DELETE \
  -o myOrg
```

---

## sf api request graphql

```bash
# Inline query
sf api request graphql \
  --body 'query { uiapi { query { Account { edges { node { Id Name { value } } } } } } }' \
  -o myOrg

# From file
sf api request graphql --body query.graphql -o myOrg

# Mutation — update a record
sf api request graphql \
  --body 'mutation updateAccount($id: ID!, $input: AccountInput!) {
    uiapi { updateAccount(id: $id, input: $input) { Record { Id Name { value } } } }
  }' \
  -o myOrg
```

---

## Practical tips

- **API version**: omit to use CLI default, or override globally with `sf config set apiVersion=62.0`.
- **Large bodies**: always use `-b @file.json` or `-f file.json` to avoid shell-escaping issues.
- **Debug**: add `-i` to inspect response status/headers when troubleshooting 4xx/5xx errors.
- **allOrNone**: use `true` when all records must succeed together; `false` for partial success.
- **Reference syntax**: `@{referenceId.field}` only works in the `/composite` endpoint (not batch).
- **Rate limits**: composite counts as **1 API call** regardless of subrequest count.
