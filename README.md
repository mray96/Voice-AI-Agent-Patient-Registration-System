# Voice AI Patient Registration System

A deployable take-home assessment with a real U.S. phone number that registers
fictional patients through a Vapi voice agent and exposes persisted records
through a REST API.

> This is a demonstration system, not a HIPAA-compliant production application.
> Never enter real patient or medical information.

## Tester quick start

Use the live phone number and public links below—no local setup or credentials
are required:

- **U.S. phone number:** **+1 (651) 386-9251** (inbound calls)
- **Voice registration demo:** https://voice-ai-agent-patient-registration.vercel.app/demo
- **Swagger API documentation:** https://voice-ai-agent-patient-registration.vercel.app/docs
- **GitHub repository:** https://github.com/mray96/Voice-AI-Agent-Patient-Registration-System

### Test the voice flow

1. Call **+1 (651) 386-9251** from a U.S. number. The free Vapi number accepts
   inbound calls; outbound calling is not needed for this assessment.
2. Use fictional details. For example: **Alex Morgan**, **April 18, 1992**,
   **Female**, **415-555-0198**, **500 Market Street, San Francisco, CA 94105**.
3. Provide optional email, insurance, emergency-contact, or language details
   when asked—or say “no.”
4. Check the complete read-back and say “yes” only when it is correct. The
   patient is saved only after confirmation.
5. Test a correction, an invalid field, and “start over.” Call again with the
   same patient phone number to test the returning-patient update offer.

The [browser voice demo](https://voice-ai-agent-patient-registration.vercel.app/demo)
is retained as a secondary testing option. Use fictional data only; this is not
a medical or HIPAA-compliant service.

### Test the REST API

Open [Swagger UI](https://voice-ai-agent-patient-registration.vercel.app/docs),
choose **Try it out**, and test `/health`, `POST /patients`, `GET /patients`,
`GET /patients/{patient_id}`, `PUT /patients/{patient_id}`, and
`DELETE /patients/{patient_id}`. Responses use the `{ data, error }` envelope.
After using the voice demo, refresh `GET /patients` to confirm the record was
persisted in PostgreSQL.

The API base URL is `https://voice-ai-agent-patient-registration.vercel.app`.

## Architecture

```text
Phone caller or browser tester
    |
    v
Vapi (PSTN/browser voice + Deepgram STT + Vapi voice + Groq Llama)
    |
    | authenticated tool calls
    v
Fastify API on Vercel
    |
    v
Drizzle ORM -> Supabase PostgreSQL
```

The REST routes and Vapi tools share `PatientService` and the same repository.
Validation occurs at the API boundary with Zod and again through PostgreSQL
types/check constraints.

## Why this stack

- **Vapi** provides the free inbound U.S. number, optional browser interface,
  and managed speech pipeline.
- **Groq + Llama 3.3 70B** provides OpenAI-compatible tool calling with a
  generous free development rate limit.
- **Fastify + TypeScript** gives a small, typed backend with structured logging.
- **Supabase PostgreSQL** provides persistent relational storage on its free
  assessment tier.
- **Vercel** deploys Fastify directly as a public HTTPS function and does not
  have Render's one-minute free-service wake-up.

## Features

- Natural voice registration with corrections, interruptions, out-of-order
  answers, optional-field opt-in, and mandatory final confirmation
- Duplicate lookup by phone number and returning-patient update flow
- Complete patient demographic schema with UUID and UTC timestamps
- Persistent PostgreSQL storage with constraints and query indexes
- Required REST CRUD operations, filters, soft deletion, and response envelopes
- Authenticated Vapi webhook with graceful tool failure responses
- Swagger UI and OpenAPI JSON
- Unit and integration tests using Fastify request injection

## REST API

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/patients` | List active patients |
| `GET` | `/patients?last_name=&date_of_birth=&phone_number=` | Filter active patients |
| `GET` | `/patients/:id` | Get one active patient |
| `POST` | `/patients` | Create a patient |
| `PUT` | `/patients/:id` | Apply a partial update |
| `DELETE` | `/patients/:id` | Soft-delete with `deleted_at` |
| `POST` | `/vapi/webhook` | Authenticated Vapi events and tools |
| `GET` | `/demo` | Public Vapi browser voice demo |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/openapi.json` | OpenAPI document |

Successful REST responses use:

```json
{ "data": {}, "error": null }
```

Errors use:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  }
}
```

Dates may be submitted as `MM/DD/YYYY` or ISO `YYYY-MM-DD`; API responses use
ISO dates. Phone numbers may include common punctuation or a leading U.S.
country code and are stored as ten digits.

## Local setup

Requirements:

- Node.js 20 or newer
- A free Supabase project
- npm

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env` and set:

```dotenv
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?sslmode=require
VAPI_WEBHOOK_SECRET=a-long-random-secret
VAPI_PUBLIC_KEY=your-vapi-public-key
VAPI_ASSISTANT_ID=6d1dd7d7-6b4e-4314-94eb-e1099762dd2d
```

The runtime reads `process.env` directly. On PowerShell, set these variables in
the same terminal before running `npm run dev` (or use `vercel env pull`):

```powershell
$env:DATABASE_URL = "postgresql://...pooler.supabase.com:6543/postgres?sslmode=require"
$env:VAPI_WEBHOOK_SECRET = "a-long-random-secret"
```

Use the Supabase **transaction pooler** connection string for Vercel. URL-encode
special characters in the database password.

### Create the database schema

The deterministic assessment setup is:

1. Open Supabase Dashboard -> SQL Editor.
2. Run [`drizzle/0000_initial.sql`](drizzle/0000_initial.sql).
3. Run
   [`drizzle/0001_enforce_nanp_phone_numbers.sql`](drizzle/0001_enforce_nanp_phone_numbers.sql).
   Existing deployments must correct any older fictional phone values that do
   not have valid NANP area and exchange prefixes before running this migration.

Run the server:

```bash
npm run dev
```

The local API is available at `http://localhost:3000`.

## Test and verify

```bash
npm test
npm run typecheck
```

Example patient creation:

```bash
curl -X POST http://localhost:3000/patients \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Doe",
    "date_of_birth": "06/15/1990",
    "sex": "Female",
    "phone_number": "415-555-0123",
    "email": "jane@example.com",
    "address_line_1": "123 Market Street",
    "city": "San Francisco",
    "state": "CA",
    "zip_code": "94105"
  }'
```

Do not use the local API for Vapi phone testing unless it is exposed through an
HTTPS tunnel. Deploy to Vercel first for the simplest setup.

## Deploy to Vercel

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. Import it into a free personal Vercel project.
3. Add `DATABASE_URL`, `VAPI_WEBHOOK_SECRET`, `VAPI_PUBLIC_KEY`, and
   `VAPI_ASSISTANT_ID` in project environment settings. The Vapi public key is
   safe to expose in the browser; never expose a Vapi private key, Groq key, or
   database credentials.
4. Deploy. Vercel detects `src/server.ts` as the Fastify entry point; it
   exposes a serverless handler while `src/app.ts` remains the local process
   entry point.
5. Verify `/health`, `/docs`, and a complete REST create/read cycle.

Keep the Vercel function in `iad1` (configured in `vercel.json`) and choose a
nearby Supabase region to reduce tool latency.

## Configure Groq and Vapi

1. Create a Groq API key at [console.groq.com](https://console.groq.com).
2. Configure the assistant's Custom LLM model with the deployed proxy URL
   `https://YOUR-PROJECT.vercel.app/vapi/llm` and model
   `llama-3.3-70b-versatile`. Add the Groq key as the Custom LLM credential.
   The proxy forwards OpenAI-compatible streaming requests to Groq.
3. Create a long random value for `VAPI_WEBHOOK_SECRET`.
4. In Vapi, create a custom server credential that sends:
   `x-vapi-secret: <the same secret>`.
5. Copy [`vapi/assistant.template.json`](vapi/assistant.template.json) and
   replace:
   - `{{API_BASE_URL}}` with the production Vercel URL, without a trailing slash.
   - `{{VAPI_SERVER_CREDENTIAL_ID}}` with the Vapi custom credential ID.
6. Create the assistant through the Vapi API or reproduce the template in the
   dashboard. The readable prompt is in
   [`vapi/system-prompt.md`](vapi/system-prompt.md).
7. Attach the assistant to the public `/demo` page using the Vapi public key.
8. Assign assistant `6d1dd7d7-6b4e-4314-94eb-e1099762dd2d` to the inbound
   number **+1 (651) 386-9251**, then place a real inbound test call. Use `/demo`
   as the secondary browser test path.

The assistant currently uses Groq's OpenAI-compatible `llama-3.3-70b-versatile`
model through the deployed `/vapi/llm` proxy.

### Vapi API import

After replacing the two placeholders, save the file as `assistant.json` and run:

```bash
curl -X POST https://api.vapi.ai/assistant \
  -H "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @assistant.json
```

The webhook also accepts `Authorization: Bearer <VAPI_WEBHOOK_SECRET>` if that
is easier to configure than `x-vapi-secret`.

## Voice acceptance checklist

Before submission, call **+1 (651) 386-9251** and cover:

- Standard required-field registration and optional-field opt-out
- A correction such as a misspelled last name
- Invalid date, phone, state, and ZIP reprompts
- Multiple details volunteered in one turn
- “Start over” midway through registration
- Read-back followed by a correction and a second confirmation
- A second call using the same phone number and the update offer
- A forced backend/tool failure that does not produce false success

Finally, query the patient from `/patients`, redeploy the Vercel application,
and query it again to prove persistence.

## Security and observability

- Secrets are environment variables and `.env` files are ignored.
- Vapi tool calls require a constant-time checked shared credential.
- REST input is validated and unknown fields are rejected.
- SQL is parameterized through Drizzle.
- Logs redact the webhook and authorization headers.
- The final saved payload is logged as required by the assessment. Only
  fictional data should be used.

The public CRUD API intentionally has no user authentication so reviewers can
test it immediately. A production version would require authentication,
authorization, audit logging, encryption controls, consent, retention policies,
and a HIPAA-eligible vendor configuration.

## Known limitations and next steps

- This is not HIPAA compliant and intentionally stores only fictional data.
- Supabase free projects may pause after approximately seven days of low
  activity. Open the project and verify `/health` plus a database query before
  review.
- Vapi voice usage becomes metered after the included test allowance.
- There is no dashboard, scheduling, multilingual flow, or call recording.
- A production version would add idempotency keys for tool retries, pagination,
  authenticated CRUD routes, transcript consent/storage, and full audit trails.
