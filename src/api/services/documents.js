// BC16 generic document service (M18) — two-phase content custody: initiate → PUT bytes → finalize.
// Any authenticated admin may upload (no role gate); the consumer's attach command carries the policy.
// Used by S5 to supply the invoice PDF that gates the `document_completeness` ops-check (DOC.3). Paths per
// API_CATALOGUE.md (Documents / Invoice artifacts).
import { request } from '../client.js'
import { postCommand } from '../envelope.js'

export const documents = {
  // Initiate → returns { document_id, status:'pending_upload', ... } (document_id derived from X-Command-Id).
  initiate:      (body)                 => postCommand('/documents', body),                          // {kind,content_type,declared_size}
  // Upload the raw PDF body (sent as-is, not JSON).
  uploadContent: (id, blob, contentType = 'application/pdf') =>
    request('PUT', `/documents/${id}/content`, { raw: true, body: blob, contentType }),
  // Finalize → hash + status 'stored' (idempotent on document_id).
  finalize:      (id)                   => postCommand(`/documents/${id}/finalize`, undefined),
}
