// Admin IAM — provision admins + role assignment (S2 user management). Paths per API_CATALOGUE.md.
import { postCommand, readById } from '../envelope.js'

const base = '/admin-users'

export const adminUsers = {
  // ── commands ──
  provision:  (body)     => postCommand(`${base}/provision`, body),                        // {email,display_name,phone}
  assignRole: (id, body) => postCommand(`${base}/${id}/roles`, body),                      // {role,override_reason?}
  revokeRole: (id, role) => postCommand(`${base}/${id}/roles/${role}/revoke`, undefined),
  disable:    (id, v)    => postCommand(`${base}/${id}/disable`, undefined, { aggregateVersion: v }),
  // ── reads ──
  get: (id) => readById(`${base}/${id}`),
}
