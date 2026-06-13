-- =============================================================================
-- 02_counterparty_platform.sql
-- Fintech Invoice Discounting Platform — Phase 1 MVP
-- Covers: BC7 Investor Onboarding, BC8 Supplier Onboarding,
--         BC9 Buyer Management, BC10 Admin IAM, BC11 Compliance,
--         BC12 Tax & Reporting, BC13 Auditor Access
--
-- Design invariants (locked — do not re-discuss):
--   • All PKs are UUIDv7 stored as UUID.
--   • Money amounts use money_paise (>= 0) or positive_money_paise (> 0) domains.
--     Currency is always INR. Raw BIGINT must not be used for monetary columns.
--   • All timestamps stored as TIMESTAMPTZ.
--   • Every aggregate table carries aggregate_version INT NOT NULL DEFAULT 1.
--   • Assumes tblIdentity(identity_id UUID PK, email TEXT UNIQUE, …) and
--     tblSession(session_id UUID PK, identity_id UUID, mfa_assertion_id UUID, …)
--     exist in a previously-run shared-kernel migration.
-- =============================================================================
-- FIX (schema-fix session): tblMfaFactor (admin_user_id-keyed) dropped from
--   BC10. Admin MFA is owned by auth.tblMfaFactor (identity_id-keyed, auth.sql).
--   mfa_factor_type ENUM removed; auth.sql uses mfa_factor_kind_enum.
--   auth.sql ALTER TABLE tblAdminUser must only ADD the FK constraint;
--   identity_id column + tblAdminUser_identity_uq UNIQUE already defined here.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------

-- BC7 -----------------------------------------------------------------------

CREATE TYPE investor_sub_type AS ENUM (
    'resident_individual',  -- Active Phase 1.
    'huf',                  -- Active Phase 1.
    'nri',                  -- Phase 2: application blocks this value in Phase 1.
    'institutional'         -- Phase 2: application blocks this value in Phase 1.
);

CREATE TYPE investor_account_status AS ENUM (
    'signed_up',
    'identity_verified',
    'kyc_submitted',
    'suitability_assessed',
    'financial_profile_completed',
    'kyc_approved',
    'mia_signed',
    'active',
    'suspended',
    'exited'
);

CREATE TYPE fatca_status AS ENUM (
    'us_person',
    'non_us_person',
    'pending'
);

-- BC8 -----------------------------------------------------------------------

CREATE TYPE supplier_constitution_type AS ENUM (
    'private_limited',
    'public_limited',
    'llp',
    'partnership',
    'proprietorship',
    'trust',
    'society'
);

CREATE TYPE supplier_account_status AS ENUM (
    'created',
    'identity_verified',
    'kyc_submitted',
    'kyc_approved',
    'credit_reviewed',
    'maa_signed',
    'active',
    'suspended',
    'blacklisted',
    'voluntarily_exited'
);

-- BC9 -----------------------------------------------------------------------

CREATE TYPE buyer_relationship_tier AS ENUM (
    'acknowledged_buyer', -- Active Phase 1 only.
    'anchor',             -- Phase 2.
    'unacknowledged_buyer'-- Phase 2.
);

CREATE TYPE buyer_acknowledgment_mode AS ENUM (
    'per_invoice', -- Active Phase 1 only.
    'blanket'      -- Phase 2.
);

CREATE TYPE buyer_account_status AS ENUM (
    'nominated',
    'identity_verified',
    'credit_assessed',
    'engagement_started',
    'active',
    'suspended'
);

-- BC10 ----------------------------------------------------------------------

CREATE TYPE admin_role AS ENUM (
    'ops_executive',
    'credit_reviewer',
    'compliance_reviewer',
    'treasury_and_settlement',
    'super_admin'
);

CREATE TYPE admin_user_status AS ENUM (
    'invited',
    'active',
    'disabled'
);

-- mfa_factor_type ENUM removed — auth layer uses mfa_factor_kind_enum
-- ('totp' | 'sms_otp') in auth.sql for the same purpose.

CREATE TYPE role_assignment_status AS ENUM (
    'active',
    'revoked'
);

CREATE TYPE sod_quarterly_review_status AS ENUM (
    'pending',
    'reviewed'
);

CREATE TYPE sod_enforcement_tier AS ENUM (
    'strict_block',        -- System-blocks the role combination outright.
    'soft_warn_with_log'   -- System warns; override is logged in deviation register.
);

-- BC11 ----------------------------------------------------------------------

CREATE TYPE aml_subject_type AS ENUM (
    'investor',
    'supplier',
    'signatory',
    'ubo'
);

CREATE TYPE aml_screening_status AS ENUM (
    'initiated',
    'completed',
    'adjudicated'
);

CREATE TYPE sar_status AS ENUM (
    'internal'
    -- 'escalated_to_fiu_ind' is a Phase 2 value; application blocks it in Phase 1.
);

CREATE TYPE kyc_file_status AS ENUM (
    'in_review',
    'approved',
    'rejected'
);

CREATE TYPE kyc_subject_type AS ENUM (
    'investor',
    'supplier'
);

CREATE TYPE kyc_refresh_status AS ENUM (
    'scheduled',
    'due',
    'completed',
    'missed'
);

-- BC12 ----------------------------------------------------------------------

CREATE TYPE investor_statement_kind AS ENUM (
    'monthly_portfolio',
    'form_16a'
);

-- BC13 ----------------------------------------------------------------------

CREATE TYPE auditor_account_status AS ENUM (
    'proposed',
    'approved',
    'activated',
    'auto_disabled'
);

CREATE TYPE auditor_sensitivity_level AS ENUM (
    'standard',
    'sensitive',
    'restricted'
);

-- =============================================================================
-- BC7 — INVESTOR ONBOARDING
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tblInvestorInvite
-- Represents a single-use invite code issued exclusively by the Compliance
-- Reviewer role (DL-036, C20).
-- ---------------------------------------------------------------------------
CREATE TABLE tblInvestorInvite (
    invite_id           UUID            NOT NULL,
    -- SHA-256 hash of the invitee e-mail. BYTEA, not plain text (privacy).
    email_hash          BYTEA           NOT NULL,
    -- SHA-256 hash of the invitee phone. BYTEA, not plain text (privacy).
    phone_hash          BYTEA           NOT NULL,
    issued_by           UUID            NOT NULL,   -- FK → tblAdminUser; must hold compliance_reviewer role.
    issued_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
    -- Invite expires 14 days after issuance. Stored as a computed value set by
    -- the application at insert time as: issued_at + INTERVAL '14 days'.
    -- Not a SQL GENERATED column because TIMESTAMPTZ generation requires an
    -- immutable function; instead the application layer is responsible for
    -- computing and inserting this value correctly.
    expiry_at           TIMESTAMPTZ     NOT NULL,
    CONSTRAINT tblInvestorInvite_expiry_coherence_chk
        CHECK (expiry_at > issued_at),
    status              TEXT            NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'consumed', 'expired')),
    consumed_at         TIMESTAMPTZ,
    -- identity_id of the investor who consumed this invite (set on consumption).
    consumed_by_identity_id UUID,
    aggregate_version   INT             NOT NULL DEFAULT 1,

    CONSTRAINT tblInvestorInvite_pk           PRIMARY KEY (invite_id),
    CONSTRAINT tblInvestorInvite_consumed_at_chk
        CHECK (
            (status = 'consumed' AND consumed_at IS NOT NULL AND consumed_by_identity_id IS NOT NULL)
            OR (status <> 'consumed' AND consumed_at IS NULL AND consumed_by_identity_id IS NULL)
        )
);

COMMENT ON TABLE tblInvestorInvite IS
    'BC7. Single-use investor invite issued only by a Compliance Reviewer admin '
    'user. Once status=consumed the record is terminal and cannot be reused. '
    'Refs: DL-036, C20, DL-008.';

COMMENT ON COLUMN tblInvestorInvite.email_hash IS
    'SHA-256 of the invitee email address stored as BYTEA (privacy). '
    'Consumption validates against tblIdentity.email (not oauth_email) — '
    'application-layer invariant.';
COMMENT ON COLUMN tblInvestorInvite.phone_hash IS
    'SHA-256 of the invitee phone number stored as BYTEA (privacy).';
COMMENT ON COLUMN tblInvestorInvite.expiry_at IS
    'Computed: issued_at + 14 days. Application must reject consumption after this timestamp.';
COMMENT ON COLUMN tblInvestorInvite.status IS
    'Terminal states: consumed, expired. Once consumed no further transitions allowed.';

-- APPLICATION-LAYER INVARIANTS: tblInvestorInvite
-- I.1  Only an admin_user whose current RoleAssignment for compliance_reviewer
--      is status=active may insert a row into this table.
-- I.2  On consumption, the application MUST validate the consuming identity
--      against tblIdentity.email (the verified canonical email), NOT against
--      any oauth_email field. Mismatch → reject.
-- I.3  Consumption is rejected if now() > expiry_at or status ≠ 'pending'.
-- I.4  Status transition pending→consumed is terminal; no further update
--      permitted.

CREATE INDEX tblInvestorInvite_issued_by_idx ON tblInvestorInvite (issued_by);
CREATE INDEX tblInvestorInvite_status_idx ON tblInvestorInvite (status) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- tblInvestorAccount
-- Aggregate root for an investor in the platform. Carries identity_id FK to
-- the shared-kernel tblIdentity. One investor per identity.
-- ---------------------------------------------------------------------------
CREATE TABLE tblInvestorAccount (
    investor_id             UUID                    NOT NULL,
    -- FK to shared-kernel tblIdentity. One-to-one (UNIQUE).
    identity_id             UUID                    NOT NULL,
    invite_id               UUID                    NOT NULL,  -- FK → tblInvestorInvite
    sub_type                investor_sub_type       NOT NULL,
    status                  investor_account_status NOT NULL DEFAULT 'signed_up',
    -- PAN: set exactly once at identity-verification time.
    pan                     pan_type,
    -- Only last 4 Aadhaar digits stored (UIDAI norms). Set exactly once.
    aadhaar_last4           aadhaar_last4_type,
    -- Last 4 of bank account number for penny-drop verification. Set exactly once.
    bank_account_last4      CHAR(4),
    fatca_status            fatca_status,
    -- nominee_doc_hash: SHA-256 reference to BC16 DocumentObject (nominee form).
    nominee_doc_hash        BYTEA,
    -- kyc_approved_by: FK → tblAdminUser; must hold compliance_reviewer role.
    kyc_approved_by         UUID,
    kyc_approved_at         TIMESTAMPTZ,
    -- mia_agreement_id: FK → BC5 MasterAgreement (cross-context by identity).
    mia_agreement_id        UUID,
    mia_signed_at           TIMESTAMPTZ,
    activated_at            TIMESTAMPTZ,
    -- kyc_refresh_due_at: activated_at + 12 months (C17). Stored computed value.
    kyc_refresh_due_at      TIMESTAMPTZ,
    suspended_at            TIMESTAMPTZ,
    suspension_reason       TEXT,
    exited_at               TIMESTAMPTZ,
    aggregate_version       INT                     NOT NULL DEFAULT 1,

    CONSTRAINT tblInvestorAccount_pk            PRIMARY KEY (investor_id),
    CONSTRAINT tblInvestorAccount_identity_uq   UNIQUE (identity_id),
    CONSTRAINT tblInvestorAccount_invite_uq     UNIQUE (invite_id),
    CONSTRAINT tblInvestorAccount_invite_fk
        FOREIGN KEY (invite_id) REFERENCES tblInvestorInvite (invite_id),
    CONSTRAINT tblInvestorAccount_bank_len_chk  CHECK (bank_account_last4 IS NULL OR char_length(bank_account_last4) = 4),
    CONSTRAINT tblInvestorAccount_activated_refresh_chk
        CHECK (
            activated_at IS NULL
            OR (kyc_refresh_due_at IS NOT NULL
                AND kyc_refresh_due_at = activated_at + INTERVAL '12 months')
        ),
    CONSTRAINT tblInvestorAccount_sub_type_phase1_chk
        -- NRI and institutional are enum values but blocked in Phase 1 (Phase 2 hook).
        CHECK (sub_type IN ('resident_individual', 'huf'))
);

COMMENT ON TABLE tblInvestorAccount IS
    'BC7. Aggregate root for an investor. Carries identity_id FK (one-to-one). '
    'Status progresses from signed_up to active through the onboarding pipeline. '
    'Refs: DL-005, DL-006, DL-050, C17, C20, C21.';

COMMENT ON COLUMN tblInvestorAccount.sub_type IS
    'Phase 1 active values: resident_individual, huf. '
    'nri and institutional exist as enum values but the application blocks them '
    'in Phase 1 (Phase 2 hook per DL-005).';
COMMENT ON COLUMN tblInvestorAccount.pan IS
    'PAN (10-char alphanumeric). Set exactly once at identity verification — '
    'application invariant. Subsequent changes require explicit re-verification.';
COMMENT ON COLUMN tblInvestorAccount.aadhaar_last4 IS
    'Last 4 digits of Aadhaar only. Full Aadhaar number is never stored '
    '(UIDAI norms, C15). Set exactly once.';
COMMENT ON COLUMN tblInvestorAccount.bank_account_last4 IS
    'Last 4 digits of the verified bank account (penny-drop). Set exactly once.';
COMMENT ON COLUMN tblInvestorAccount.kyc_refresh_due_at IS
    'Stored computed value: activated_at + 12 months (C17, DL-037). '
    'Scheduler fires KycRefresh.Due at this timestamp.';

-- APPLICATION-LAYER INVARIANTS: tblInvestorAccount
-- IA.1  pan, aadhaar_last4, bank_account_last4 are each set exactly once
--       at the event that verifies them.  No UPDATE on those columns permitted
--       after initial set; re-verification is a new command with a new event.
-- IA.2  sub_type nri and institutional must be rejected by the application
--       command handler with a clear "Phase 2 only" error until unlocked.
-- IA.3  status=active requires: identity verified, KYC approved by Compliance
--       Reviewer, MIA signed, and a completed SuitabilityAssessment where either
--       mismatch=false OR override_text_hash IS NOT NULL.
-- IA.4  If SuitabilityAssessment.mismatch=true, override_text_hash must be set
--       before the investor may be activated (C21, G26).
-- IA.5  Annual KYC refresh (C17): scheduler checks kyc_refresh_due_at and emits
--       KycRefresh.Due; missed refresh does not auto-suspend in Phase 1 (DL-037).
-- IA.6  status=exited only when investor has zero subscriptions in non-terminal
--       status (BC2 read-side check before issuing Exit command).

CREATE INDEX tblInvestorAccount_identity_idx ON tblInvestorAccount (identity_id);
CREATE INDEX tblInvestorAccount_status_idx   ON tblInvestorAccount (status);
CREATE INDEX tblInvestorAccount_kyc_refresh_due_idx
    ON tblInvestorAccount (kyc_refresh_due_at)
    WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- tblSuitabilityAssessment
-- Immutable after creation. If mismatch=true, override_text_hash must be set
-- before InvestorAccount can be activated (C21, G26).
-- ---------------------------------------------------------------------------
CREATE TABLE tblSuitabilityAssessment (
    assessment_id       UUID        NOT NULL,
    investor_id         UUID        NOT NULL,  -- FK → tblInvestorAccount
    -- questionnaire_doc_hash: SHA-256 reference into BC16 for raw answers.
    questionnaire_doc_hash BYTEA    NOT NULL,
    mismatch            BOOLEAN     NOT NULL,
    -- override_text_hash: required when mismatch=true before activation.
    -- SHA-256 of the investor's acknowledgment text stored in BC16.
    override_text_hash  BYTEA,
    assessed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    aggregate_version   INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblSuitabilityAssessment_pk  PRIMARY KEY (assessment_id),
    CONSTRAINT tblSuitabilityAssessment_investor_fk
        FOREIGN KEY (investor_id) REFERENCES tblInvestorAccount (investor_id),
    -- Override text is only meaningful when there is a mismatch.
    -- The cross-row constraint (activation blocked until override set when
    -- mismatch=true) is enforced at application layer — see APPLICATION-LAYER
    -- INVARIANTS SA.2 below.
    CONSTRAINT tblSuitabilityAssessment_override_only_on_mismatch_chk
        CHECK (mismatch = true OR override_text_hash IS NULL)
);

COMMENT ON TABLE tblSuitabilityAssessment IS
    'BC7. Suitability assessment questionnaire result for an investor. '
    'Immutable after creation. Refs: C21, G26, DL-050.';

COMMENT ON COLUMN tblSuitabilityAssessment.mismatch IS
    'True when investor answers indicate a product mismatch against their '
    'declared risk profile.';
COMMENT ON COLUMN tblSuitabilityAssessment.override_text_hash IS
    'SHA-256 of investor-acknowledged override text (stored in BC16). '
    'Must be set before InvestorAccount can be activated when mismatch=true. '
    'Application-layer invariant — not expressible as a single-row CHECK.';

-- APPLICATION-LAYER INVARIANTS: tblSuitabilityAssessment
-- SA.1  Row is immutable after insert. No UPDATEs permitted.
-- SA.2  When mismatch=true and override_text_hash IS NULL at activation time,
--       the Activate command MUST be rejected by the application handler.
--       override_text_hash may only be populated by the investor via
--       AcknowledgeSuitabilityOverride command, which sets it in the same
--       assessment row before activation.

CREATE INDEX tblSuitabilityAssessment_investor_idx ON tblSuitabilityAssessment (investor_id);


-- =============================================================================
-- BC8 — SUPPLIER ONBOARDING
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tblSupplierAccount
-- Aggregate root for a supplier. NO identity_id FK — suppliers have no login
-- in Phase 1. Admin acts on behalf under AgencyConsent (DL-012, DL-013).
-- ---------------------------------------------------------------------------
CREATE TABLE tblSupplierAccount (
    supplier_id             UUID                        NOT NULL,
    legal_name              TEXT                        NOT NULL,
    constitution_type       supplier_constitution_type  NOT NULL,
    pan                     pan_type                    NOT NULL,
    gstin                   gstin_type,
    cin                     CHAR(21),   -- Corporate Identity Number (MCA).
    -- udyam: Udyam Registration Number. Nullable; Phase 2 hook (DL-001).
    udyam                   VARCHAR(19),
    status                  supplier_account_status     NOT NULL DEFAULT 'created',
    -- kyc_approved_by: FK → tblAdminUser; must hold compliance_reviewer role.
    kyc_approved_by         UUID,
    kyc_approved_at         TIMESTAMPTZ,
    -- credit_review_outcome: denormalised snapshot for quick operational reads.
    credit_exposure_cap_paise money_paise,
    credit_risk_rating      TEXT,
    -- maa_agreement_id: FK → BC5 MasterAgreement (cross-context by identity).
    maa_agreement_id        UUID,
    maa_signed_at           TIMESTAMPTZ,
    activated_at            TIMESTAMPTZ,
    suspended_at            TIMESTAMPTZ,
    suspension_reason       TEXT,
    blacklisted_at          TIMESTAMPTZ,
    blacklist_reason        TEXT,
    voluntarily_exited_at   TIMESTAMPTZ,
    aggregate_version       INT                         NOT NULL DEFAULT 1,

    CONSTRAINT tblSupplierAccount_pk       PRIMARY KEY (supplier_id)
);

COMMENT ON TABLE tblSupplierAccount IS
    'BC8. Aggregate root for a supplier. Suppliers have NO login in Phase 1; '
    'all admin actions are performed under AgencyConsent (DL-012, DL-013). '
    'identity_id FK is intentionally absent. Refs: DL-012, DL-013, DL-014.';

COMMENT ON COLUMN tblSupplierAccount.udyam IS
    'Udyam Registration Number. Present in schema as a Phase 2 hook (DL-001). '
    'Nullable and unused in Phase 1.';
COMMENT ON COLUMN tblSupplierAccount.credit_exposure_cap_paise IS
    'Denormalised snapshot from BC3 SupplierCreditProfile. money_paise domain (>= 0). Null until credit review completed.';

-- APPLICATION-LAYER INVARIANTS: tblSupplierAccount
-- SA8.1  Every admin action on a supplier record must reference an active
--        AgencyConsent row for that supplier (AC.1).  The application handler
--        checks this before any state-changing command executes.
-- SA8.2  Legal-signature commands (e-sign on MAA) are never delegable under
--        agency; the supplier's authorised signatory must sign personally (AC.2).
-- SA8.3  voluntary_exit (status=voluntarily_exited) is only permitted when
--        the supplier has zero live invoices in non-terminal status across BC1.
--        Application performs a read-side BC1 check before issuing Exit command.
-- SA8.4  AgencyAction.Recorded envelope must be emitted for every admin command
--        executed under agency, with the consent_id referenced (G5, DL-013).
-- SA8.5  Annual KYC refresh cadence tracked via tblKycRefreshSchedule (C17).

CREATE INDEX tblSupplierAccount_status_idx ON tblSupplierAccount (status);
CREATE INDEX tblSupplierAccount_pan_idx    ON tblSupplierAccount (pan);

-- ---------------------------------------------------------------------------
-- tblAgencyConsent
-- Every admin agency action on a supplier must reference an active consent.
-- scope TEXT[] lists the permitted action categories.
-- ---------------------------------------------------------------------------
CREATE TABLE tblAgencyConsent (
    consent_id          UUID        NOT NULL,
    supplier_id         UUID        NOT NULL,  -- FK → tblSupplierAccount
    -- scope: array of permitted action categories granted by the supplier.
    scope               TEXT[]      NOT NULL,
    -- consent_doc_hash: SHA-256 reference into BC16 (signed consent document).
    consent_doc_hash    BYTEA       NOT NULL,
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at          TIMESTAMPTZ,
    revoked_by          UUID,       -- FK → tblAdminUser or NULL (supplier self-revoked).
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    aggregate_version   INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblAgencyConsent_pk      PRIMARY KEY (consent_id),
    CONSTRAINT tblAgencyConsent_supplier_fk
        FOREIGN KEY (supplier_id) REFERENCES tblSupplierAccount (supplier_id),
    CONSTRAINT tblAgencyConsent_revoke_chk
        CHECK (
            (is_active = TRUE AND revoked_at IS NULL)
            OR (is_active = FALSE AND revoked_at IS NOT NULL)
        )
);

COMMENT ON TABLE tblAgencyConsent IS
    'BC8. Records the supplier''s explicit consent for the platform to act on '
    'their behalf (G5). Every admin agency action must reference an active '
    'consent row for the relevant supplier_id. Refs: DL-013, G5.';

COMMENT ON COLUMN tblAgencyConsent.scope IS
    'Array of permitted action categories (e.g. kyc_submission, financial_profile, '
    'invoice_submission). Application validates each command against this list.';

-- APPLICATION-LAYER INVARIANTS: tblAgencyConsent
-- AC.1  Before any agency command executes, handler queries for an active consent
--       (is_active=TRUE) for the supplier_id and validates that the action falls
--       within scope[].  Missing or inactive consent → command rejected.
-- AC.2  e-sign commands are never covered by agency consent; the supplier's
--       authorised signatory must authenticate directly via BC19.
-- AC.3  AgencyAction.Recorded envelope emitted for every successful agency command.

CREATE INDEX tblAgencyConsent_supplier_active_idx
    ON tblAgencyConsent (supplier_id) WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- tblSupplierFinancialProfile
-- One per supplier (UNIQUE constraint on supplier_id).
-- ---------------------------------------------------------------------------
CREATE TABLE tblSupplierFinancialProfile (
    financial_profile_id        UUID        NOT NULL,
    supplier_id                 UUID        NOT NULL,  -- FK → tblSupplierAccount
    -- submitted_doc_hashes: array of SHA-256 refs into BC16.
    submitted_doc_hashes        BYTEA[]     NOT NULL DEFAULT '{}',
    -- TTL timestamps set per A2 §1.4 (GST 90d, AA bank statement 90d).
    gst_returns_ttl_until       TIMESTAMPTZ,
    aa_bank_statement_ttl_until TIMESTAMPTZ,
    -- top_buyers: JSONB array of {buyer_name, gstin, annual_turnover_paise}.
    top_buyers                  JSONB       NOT NULL DEFAULT '[]',
    status                      TEXT        NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'reviewed')),
    submitted_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    aggregate_version           INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblSupplierFinancialProfile_pk          PRIMARY KEY (financial_profile_id),
    CONSTRAINT tblSupplierFinancialProfile_supplier_uq UNIQUE (supplier_id),
    CONSTRAINT tblSupplierFinancialProfile_supplier_fk
        FOREIGN KEY (supplier_id) REFERENCES tblSupplierAccount (supplier_id)
);

COMMENT ON TABLE tblSupplierFinancialProfile IS
    'BC8. Financial profile for a supplier. Exactly one per supplier (UNIQUE). '
    'GST returns and AA bank statement have TTLs per A2 §1.4. '
    'Refs: DL-014, A2 §1.4, C24.';

COMMENT ON COLUMN tblSupplierFinancialProfile.gst_returns_ttl_until IS
    'TTL for GST returns data: 90 days from fetch (A2 §1.4). '
    'Re-pull required on expiry before credit review proceeds.';
COMMENT ON COLUMN tblSupplierFinancialProfile.aa_bank_statement_ttl_until IS
    'TTL for AA bank statement: 90 days from delivery (A2 §1.4).';

-- APPLICATION-LAYER INVARIANTS: tblSupplierFinancialProfile
-- FP.1  All financial data must be verified via BC17 (Aggregator ACL), not
--       self-attested.  The handler must check BC17 verification status (C24).
-- FP.2  On TTL expiry of gst_returns or aa_bank_statement, BC17 re-pull is
--       required before the credit review command is accepted.

CREATE INDEX tblSupplierFinancialProfile_supplier_idx ON tblSupplierFinancialProfile (supplier_id);


-- =============================================================================
-- BC9 — BUYER MANAGEMENT
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tblBuyerAccount
-- Aggregate root for a buyer on the platform.
-- ---------------------------------------------------------------------------
CREATE TABLE tblBuyerAccount (
    buyer_id                UUID                        NOT NULL,
    legal_name              TEXT                        NOT NULL,
    mca_cin                 CHAR(21),
    gstin                   gstin_type,
    sector                  TEXT,
    -- relationship_tier: Phase 1 locks to acknowledged_buyer only.
    -- anchor and unacknowledged_buyer are Phase 2 values (C25).
    relationship_tier       buyer_relationship_tier     NOT NULL DEFAULT 'acknowledged_buyer'
        CONSTRAINT tblBuyerAccount_tier_phase1_chk
            CHECK (relationship_tier = 'acknowledged_buyer'),
    -- acknowledgment_mode: Phase 1 locks to per_invoice only (DL-019).
    -- blanket is a Phase 2 value.
    acknowledgment_mode     buyer_acknowledgment_mode   NOT NULL DEFAULT 'per_invoice'
        CONSTRAINT tblBuyerAccount_ack_mode_phase1_chk
            CHECK (acknowledgment_mode = 'per_invoice'),
    status                  buyer_account_status        NOT NULL DEFAULT 'nominated',
    -- credit_limit_paise: snapshot from BC3 BuyerCreditProfile.
    credit_limit_paise      positive_money_paise,
    pricing_band_id         UUID,   -- cross-context reference to BC3 PricingBand.
    -- noa_doc_hash: SHA-256 ref to signed Notice of Assignment in BC16.
    noa_doc_hash            BYTEA,
    nominated_by            UUID    NOT NULL,  -- FK → tblAdminUser (Credit Reviewer).
    activated_at            TIMESTAMPTZ,
    suspended_at            TIMESTAMPTZ,
    suspension_reason       TEXT,
    aggregate_version       INT     NOT NULL DEFAULT 1,

    CONSTRAINT tblBuyerAccount_pk             PRIMARY KEY (buyer_id)
);

COMMENT ON TABLE tblBuyerAccount IS
    'BC9. Aggregate root for a buyer. Phase 1 accepts only acknowledged_buyer '
    'tier and per_invoice acknowledgment mode; anchor and unacknowledged_buyer '
    'are Phase 2 enum values present in schema for superset-readiness (DL-001, '
    'DL-019, DL-020). Refs: DL-018, DL-019, DL-020, DL-021.';

COMMENT ON COLUMN tblBuyerAccount.relationship_tier IS
    'Phase 1: acknowledged_buyer only. anchor and unacknowledged_buyer are '
    'Phase 2 (DL-020). CHECK constraint enforces the Phase 1 restriction; '
    'remove the constraint when unlocking Phase 2.';
COMMENT ON COLUMN tblBuyerAccount.acknowledgment_mode IS
    'Phase 1: per_invoice only (DL-019). blanket is Phase 2. CHECK constraint '
    'enforces Phase 1 restriction.';

-- APPLICATION-LAYER INVARIANTS: tblBuyerAccount
-- BA.1  At least one AcknowledgmentUser with status=active must exist for a
--       buyer before status can advance to active (DL-021).
-- BA.2  BuyerAccount suspension (status=suspended) requires maker-checker:
--       checker must be a different admin user than the initiator (C4).
-- BA.3  All buyer identity data (MCA CIN, GSTIN) must be verified via BC17
--       before status advances beyond identity_verified (C24).

CREATE INDEX tblBuyerAccount_status_idx ON tblBuyerAccount (status);

-- ---------------------------------------------------------------------------
-- tblAcknowledgmentUser
-- Authorised buyer contact for invoice acknowledgment.
-- Carries identity_id FK. Login = OTP only; no tblCredential row created.
-- ---------------------------------------------------------------------------
CREATE TABLE tblAcknowledgmentUser (
    ack_user_id         UUID        NOT NULL,
    buyer_id            UUID        NOT NULL,  -- FK → tblBuyerAccount
    -- identity_id: FK → tblIdentity. One identity per acknowledgment user.
    identity_id         UUID        NOT NULL,
    display_name        TEXT        NOT NULL,
    email               TEXT        NOT NULL,
    phone               TEXT        NOT NULL,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    designated_by       UUID        NOT NULL,  -- FK → tblAdminUser (Ops Executive).
    designated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at      TIMESTAMPTZ,
    aggregate_version   INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblAcknowledgmentUser_pk             PRIMARY KEY (ack_user_id),
    CONSTRAINT tblAcknowledgmentUser_identity_uq    UNIQUE (identity_id),
    CONSTRAINT tblAcknowledgmentUser_buyer_fk
        FOREIGN KEY (buyer_id) REFERENCES tblBuyerAccount (buyer_id),
    CONSTRAINT tblAcknowledgmentUser_deactivate_chk
        CHECK (
            (is_active = TRUE AND deactivated_at IS NULL)
            OR (is_active = FALSE AND deactivated_at IS NOT NULL)
        )
);

COMMENT ON TABLE tblAcknowledgmentUser IS
    'BC9. Buyer''s authorised user for invoice acknowledgment. Carries '
    'identity_id FK. Login is OTP-only; no tblCredential row is created for '
    'this identity — application-layer invariant (DL-021). Refs: DL-021.';

COMMENT ON COLUMN tblAcknowledgmentUser.identity_id IS
    'FK → tblIdentity. Login is OTP-only. The application must never create '
    'a tblCredential row for this identity — application-layer invariant.';

-- APPLICATION-LAYER INVARIANTS: tblAcknowledgmentUser
-- AU.1  Login mechanism for AcknowledgmentUser is OTP-only (SMS/email).
--       The application must NEVER create a tblCredential row for the
--       associated identity_id.
-- AU.2  Deactivation of an AcknowledgmentUser is blocked if it would leave
--       the buyer with zero active acknowledgment users.  Application performs
--       a count check on (buyer_id, is_active=TRUE) before deactivation.

CREATE INDEX tblAcknowledgmentUser_buyer_active_idx
    ON tblAcknowledgmentUser (buyer_id) WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- tblPaymentInstruction
-- Current payment instruction for a buyer. Only one current per buyer at a
-- time — enforced via partial UNIQUE index on superseded_by IS NULL.
-- ---------------------------------------------------------------------------
CREATE TABLE tblPaymentInstruction (
    instruction_id      UUID        NOT NULL,
    buyer_id            UUID        NOT NULL,  -- FK → tblBuyerAccount
    -- instruction_doc_hash: SHA-256 reference into BC16 for the confirmed doc.
    instruction_doc_hash BYTEA      NOT NULL,
    effective_from      DATE        NOT NULL,
    -- superseded_by: set when a newer PaymentInstruction is confirmed.
    superseded_by       UUID,       -- FK → tblPaymentInstruction (self-referential).
    confirmed_by        UUID        NOT NULL,  -- FK → tblAdminUser (Ops Executive).
    confirmed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    aggregate_version   INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblPaymentInstruction_pk          PRIMARY KEY (instruction_id),
    CONSTRAINT tblPaymentInstruction_buyer_fk
        FOREIGN KEY (buyer_id) REFERENCES tblBuyerAccount (buyer_id),
    CONSTRAINT tblPaymentInstruction_superseded_fk
        FOREIGN KEY (superseded_by) REFERENCES tblPaymentInstruction (instruction_id)
);

COMMENT ON TABLE tblPaymentInstruction IS
    'BC9. Buyer payment/remittance instruction. Exactly one current (unsuperseded) '
    'instruction per buyer enforced via partial unique index. Supersession pattern '
    'mirrors PricingBand. Refs: Spec §2.3.';

COMMENT ON COLUMN tblPaymentInstruction.superseded_by IS
    'NULL means this is the current instruction. Non-NULL means it has been '
    'replaced; the referenced row is the successor.';

-- Enforces one current PaymentInstruction per buyer.
CREATE UNIQUE INDEX tblPaymentInstruction_buyer_current_uq
    ON tblPaymentInstruction (buyer_id)
    WHERE superseded_by IS NULL;

CREATE INDEX tblPaymentInstruction_buyer_idx ON tblPaymentInstruction (buyer_id);


-- =============================================================================
-- BC10 — ADMIN IAM
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tblAdminUser
-- Aggregate root for a platform admin user. Carries identity_id FK (UNIQUE).
-- MFA factors live in the auth layer (auth.tblMfaFactor, keyed on identity_id).
-- At least one active TOTP factor required before status=active (C7, DL-035).
-- Every state-changing command requires mfa_assertion_id from tblSession (C7).
-- ---------------------------------------------------------------------------
CREATE TABLE tblAdminUser (
    admin_user_id       UUID                NOT NULL,
    -- identity_id: FK → tblIdentity. One-to-one (UNIQUE).
    identity_id         UUID                NOT NULL,
    email               TEXT                NOT NULL,
    display_name        TEXT                NOT NULL,
    status              admin_user_status   NOT NULL DEFAULT 'invited',
    -- tenant_claims: JSONB array; enforced at repository layer (C16, G19).
    tenant_claims       JSONB               NOT NULL DEFAULT '[]',
    disabled_at         TIMESTAMPTZ,
    disabled_by         UUID,   -- FK → tblAdminUser (Super Admin).
    aggregate_version   INT                 NOT NULL DEFAULT 1,

    CONSTRAINT tblAdminUser_pk              PRIMARY KEY (admin_user_id),
    CONSTRAINT tblAdminUser_identity_uq     UNIQUE (identity_id),
    CONSTRAINT tblAdminUser_email_uq        UNIQUE (email),
    CONSTRAINT tblAdminUser_disabled_by_fk
        FOREIGN KEY (disabled_by) REFERENCES tblAdminUser (admin_user_id)
);

COMMENT ON TABLE tblAdminUser IS
    'BC10. Platform admin user. Carries identity_id FK (one-to-one). '
    'Roles are assigned separately via tblRoleAssignment. '
    'At least one TOTP MFA factor must be enrolled before status=active — '
    'application-layer invariant (C7, DL-035). '
    'Every state-changing command in every context requires a valid '
    'mfa_assertion_id from tblSession — application-layer invariant (C7). '
    'Refs: DL-031, DL-032, DL-035, C7, C16.';

COMMENT ON COLUMN tblAdminUser.tenant_claims IS
    'JSONB array of tenant-scoped claims issued at session establishment. '
    'Enforced at repository layer (G19); never UI-only (C16).';

-- APPLICATION-LAYER INVARIANTS: tblAdminUser
-- AU10.1  status cannot advance to active unless auth.tblMfaFactor contains
--         at least one active TOTP factor for this admin user's identity_id
--         (C7, DL-035). MFA is owned by the auth layer — resolve via:
--         tblAdminUser.identity_id → tblIdentity → auth.tblMfaFactor.
-- AU10.2  Every state-changing command across all bounded contexts must supply
--         a mfa_assertion_id referencing a valid, non-expired
--         tblSession.mfa_assertion_id for this admin_user_id (C7, B2 §2.2).
-- AU10.3  AuditorAccount (BC13) identity must not share identity_id with any
--         admin user who holds an active operational role (C19 — see BC13).

-- tblAdminUser_identity_idx omitted: tblAdminUser_identity_uq UNIQUE already
-- creates an implicit index on identity_id. auth.sql must NOT re-add this index
-- (would collide). auth.sql ALTER TABLE must only ADD the FK constraint.
CREATE INDEX tblAdminUser_email_idx    ON tblAdminUser (email);

-- ---------------------------------------------------------------------------
-- MFA FACTORS — OWNED BY THE AUTH LAYER (auth.sql)
-- tblMfaFactor dropped from BC10. Admin MFA factors live in
-- auth.tblMfaFactor, keyed on identity_id (not admin_user_id).
-- Resolution path:
--   tblAdminUser.admin_user_id
--     → tblAdminUser.identity_id
--     → auth.tblMfaFactor.identity_id
-- auth.tblMfaFactor has stronger constraints than the dropped table:
--   • EXCLUDE prevents silent TOTP shadow re-enrolment.
--   • totp_has_secret CHECK enforces secret presence for TOTP factors.
--   • secret_ref TEXT stores a vault reference — raw secret never in DB.
-- mfa_factor_type ENUM also removed; auth.sql uses mfa_factor_kind_enum.
-- Refs: C7, DL-035, auth.sql invariants A1 (KIND/CREDENTIAL/FACTOR MATRIX),
--       A2 (ADMIN ACTIVATION GATE).
-- MIGRATION NOTE: auth.sql ALTER TABLE tblAdminUser must only ADD the FK
-- constraint (tblAdminUser_identity_fk). The identity_id column and
-- tblAdminUser_identity_uq UNIQUE constraint are already defined above.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- tblRoleAssignment
-- Composite natural PK (admin_user_id, role). One row per user-role pair.
-- Strict SoD: credit_reviewer + treasury_and_settlement cannot coexist for
-- the same user — application invariant (strict system-block per DL-033, C5).
-- ---------------------------------------------------------------------------
CREATE TABLE tblRoleAssignment (
    admin_user_id               UUID                    NOT NULL,  -- FK → tblAdminUser
    role                        admin_role              NOT NULL,
    status                      role_assignment_status  NOT NULL DEFAULT 'active',
    assigned_at                 TIMESTAMPTZ             NOT NULL DEFAULT now(),
    assigned_by                 UUID                    NOT NULL,  -- FK → tblAdminUser (Super Admin).
    revoked_at                  TIMESTAMPTZ,
    revoked_by                  UUID,   -- FK → tblAdminUser.
    -- sod_warning_acknowledged_at: set when a soft SoD pair is overridden.
    sod_warning_acknowledged_at TIMESTAMPTZ,
    override_reason             TEXT,
    -- deviation_register_entry_id: FK → tblDeviationEntry when soft SoD is triggered.
    deviation_register_entry_id UUID,
    aggregate_version           INT                     NOT NULL DEFAULT 1,

    CONSTRAINT tblRoleAssignment_pk         PRIMARY KEY (admin_user_id, role),
    CONSTRAINT tblRoleAssignment_admin_user_fk
        FOREIGN KEY (admin_user_id) REFERENCES tblAdminUser (admin_user_id),
    CONSTRAINT tblRoleAssignment_assigned_by_fk
        FOREIGN KEY (assigned_by) REFERENCES tblAdminUser (admin_user_id),
    CONSTRAINT tblRoleAssignment_revoked_by_fk
        FOREIGN KEY (revoked_by) REFERENCES tblAdminUser (admin_user_id),
    CONSTRAINT tblRoleAssignment_revoke_chk
        CHECK (
            (status = 'active' AND revoked_at IS NULL AND revoked_by IS NULL)
            OR (status = 'revoked' AND revoked_at IS NOT NULL)
        ),
    CONSTRAINT tblRoleAssignment_soft_sod_override_chk
        CHECK (
            deviation_register_entry_id IS NULL
            OR (sod_warning_acknowledged_at IS NOT NULL AND override_reason IS NOT NULL)
        )
);

COMMENT ON TABLE tblRoleAssignment IS
    'BC10. Role assignment for an admin user. Composite natural PK. '
    'STRICT SoD BLOCK (DL-033, C5): credit_reviewer + treasury_and_settlement '
    'cannot coexist as active assignments for the same admin_user_id — '
    'application-layer invariant; the command handler rejects the Assign command '
    'before this row is inserted. '
    'Soft SoD pairs (Super Admin+Compliance Reviewer, Ops Executive+Treasury, '
    'Credit Reviewer+Compliance Reviewer) require override_reason and create a '
    'DeviationEntry — application-layer invariant. '
    'Refs: DL-031, DL-032, DL-033, C5.';

COMMENT ON COLUMN tblRoleAssignment.deviation_register_entry_id IS
    'FK → tblDeviationEntry. Set when assignment triggers a soft SoD pair. '
    'Must be set alongside override_reason and sod_warning_acknowledged_at.';

-- APPLICATION-LAYER INVARIANTS: tblRoleAssignment
-- RA.1  STRICT SoD BLOCK: before inserting a row for credit_reviewer, the
--       handler checks that no active treasury_and_settlement row exists for
--       the same admin_user_id, and vice versa.  Violation → command rejected
--       with SodStrictViolation error (C5, DL-033).
-- RA.2  Soft SoD pairs (super_admin+compliance_reviewer,
--       ops_executive+treasury_and_settlement,
--       credit_reviewer+compliance_reviewer) issue a warning.  The actor must
--       supply override_reason; a DeviationEntry row is created atomically.
-- RA.3  Exactly one DeviationEntry is created per soft-SoD assignment event;
--       its PK is stored in deviation_register_entry_id.
-- RA.4  AuditorAccount identity (BC13) must never hold any operational role;
--       the handler cross-checks tblAuditorAccount before assignment.

CREATE INDEX tblRoleAssignment_admin_user_idx ON tblRoleAssignment (admin_user_id);
CREATE INDEX tblRoleAssignment_role_active_idx
    ON tblRoleAssignment (role, admin_user_id) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- tblDeviationEntry
-- Managed Deviation Register. Immutable except quarterly_review fields.
-- combo TEXT[2]: the two roles forming the soft SoD pair.
-- ---------------------------------------------------------------------------
CREATE TABLE tblDeviationEntry (
    deviation_register_entry_id UUID                        NOT NULL,
    admin_user_id               UUID                        NOT NULL,  -- FK → tblAdminUser
    -- combo: exactly two role values representing the soft SoD pair.
    combo                       TEXT[]                      NOT NULL
        CONSTRAINT tblDeviationEntry_combo_len_chk CHECK (array_length(combo, 1) = 2),
    reason                      TEXT                        NOT NULL,
    created_at                  TIMESTAMPTZ                 NOT NULL DEFAULT now(),
    quarterly_review_status     sod_quarterly_review_status NOT NULL DEFAULT 'pending',
    -- review_decision: set exactly once at quarterly review (DE.1).
    review_decision             TEXT,
    reviewed_at                 TIMESTAMPTZ,
    reviewed_by                 UUID,   -- FK → tblAdminUser (Super Admin).
    aggregate_version           INT                         NOT NULL DEFAULT 1,

    CONSTRAINT tblDeviationEntry_pk             PRIMARY KEY (deviation_register_entry_id),
    CONSTRAINT tblDeviationEntry_admin_user_fk
        FOREIGN KEY (admin_user_id) REFERENCES tblAdminUser (admin_user_id),
    CONSTRAINT tblDeviationEntry_reviewed_by_fk
        FOREIGN KEY (reviewed_by) REFERENCES tblAdminUser (admin_user_id),
    CONSTRAINT tblDeviationEntry_review_chk
        CHECK (
            (quarterly_review_status = 'pending'
                AND review_decision IS NULL
                AND reviewed_at IS NULL)
            OR (quarterly_review_status = 'reviewed'
                AND review_decision IS NOT NULL
                AND reviewed_at IS NOT NULL)
        )
);

COMMENT ON TABLE tblDeviationEntry IS
    'BC10. Managed Deviation Register entry for soft SoD pair overrides. '
    'Immutable except the quarterly review fields (review_decision, reviewed_at, '
    'reviewed_by), which are set exactly once. Reviewed quarterly by Super Admin. '
    'Refs: DL-033, DL-034, C5.';

COMMENT ON COLUMN tblDeviationEntry.combo IS
    'TEXT[2]: the two admin_role values forming the soft SoD pair '
    '(e.g. ARRAY[''super_admin'',''compliance_reviewer'']).';
COMMENT ON COLUMN tblDeviationEntry.review_decision IS
    'Set exactly once at quarterly review.  Immutable thereafter — '
    'application-layer invariant.';

-- APPLICATION-LAYER INVARIANTS: tblDeviationEntry
-- DE.1  The row is immutable after insert except for the quarterly review
--       fields (quarterly_review_status, review_decision, reviewed_at,
--       reviewed_by), which may be set exactly once.  Any attempt to update
--       non-review fields after insert must be rejected.
-- DE.2  review_decision, reviewed_at, reviewed_by must all be set in a single
--       atomic update; partial updates are rejected.

CREATE INDEX tblDeviationEntry_admin_user_idx ON tblDeviationEntry (admin_user_id);
CREATE INDEX tblDeviationEntry_review_status_idx
    ON tblDeviationEntry (quarterly_review_status) WHERE quarterly_review_status = 'pending';

-- ---------------------------------------------------------------------------
-- tblSodPolicy
-- Rules-as-data table. One current active policy at a time (supersession).
-- ---------------------------------------------------------------------------
CREATE TABLE tblSodPolicy (
    sod_policy_id       UUID                    NOT NULL,
    -- strict_pairs: JSONB array of [role, role] pairs that are system-blocked.
    strict_pairs        JSONB                   NOT NULL DEFAULT '[]',
    -- soft_pairs: JSONB array of [role, role] pairs that warn + log deviation.
    soft_pairs          JSONB                   NOT NULL DEFAULT '[]',
    enforcement_tier    sod_enforcement_tier    NOT NULL,
    effective_from      TIMESTAMPTZ             NOT NULL DEFAULT now(),
    -- superseded_by: NULL means this is the current policy.
    superseded_by       UUID,   -- FK → tblSodPolicy (self-referential).
    published_by        UUID    NOT NULL,  -- FK → tblAdminUser (Super Admin).
    aggregate_version   INT     NOT NULL DEFAULT 1,

    CONSTRAINT tblSodPolicy_pk PRIMARY KEY (sod_policy_id),
    CONSTRAINT tblSodPolicy_superseded_fk
        FOREIGN KEY (superseded_by) REFERENCES tblSodPolicy (sod_policy_id),
    CONSTRAINT tblSodPolicy_published_by_fk
        FOREIGN KEY (published_by) REFERENCES tblAdminUser (admin_user_id)
);

COMMENT ON TABLE tblSodPolicy IS
    'BC10. SoD policy as rules-as-data. Exactly one current policy (superseded_by '
    'IS NULL). Phase 1 fixed policy: strict = {(credit_reviewer, '
    'treasury_and_settlement)}; soft = {(super_admin, compliance_reviewer), '
    '(ops_executive, treasury_and_settlement), (credit_reviewer, '
    'compliance_reviewer)} per DL-033, C5. Refs: DL-033, C5.';

COMMENT ON COLUMN tblSodPolicy.strict_pairs IS
    'JSONB array of [role, role] pairs blocked at system level.';
COMMENT ON COLUMN tblSodPolicy.soft_pairs IS
    'JSONB array of [role, role] pairs that trigger a warning and '
    'mandate a DeviationEntry.';

-- Enforces one current SodPolicy at a time.
-- Indexes a constant expression so the UNIQUE constraint means at most one row
-- can satisfy the WHERE clause (the active-policy slot).
CREATE UNIQUE INDEX tblSodPolicy_one_active_uq
    ON tblSodPolicy ((1))
    WHERE superseded_by IS NULL;


-- =============================================================================
-- BC11 — COMPLIANCE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tblAmlScreening
-- AML/PEP screening record. One-time at onboarding in Phase 1.
-- subject_type covers investor, supplier, signatory, ubo.
-- ---------------------------------------------------------------------------
CREATE TABLE tblAmlScreening (
    screening_id            UUID                    NOT NULL,
    subject_id              UUID                    NOT NULL,  -- cross-context: investor_id, supplier_id, or signatory/ubo identity.
    subject_type            aml_subject_type        NOT NULL,
    status                  aml_screening_status    NOT NULL DEFAULT 'initiated',
    -- match_score: vendor-returned score (0.0–1.0 range typical).
    match_score             NUMERIC(5,4),
    -- hits: JSONB array of {name, hit_type, score, source} from vendor.
    hits                    JSONB                   NOT NULL DEFAULT '[]',
    -- adjudication_decision: 'clear', 'false_positive', 'true_hit_suspend'.
    adjudication_decision   TEXT,
    adjudicated_by          UUID,   -- FK → tblAdminUser (Compliance Reviewer).
    adjudicated_at          TIMESTAMPTZ,
    -- vendor_payload_hash: SHA-256 ref into BC16 for raw vendor response (C24).
    vendor_payload_hash     BYTEA,
    screened_at             TIMESTAMPTZ             NOT NULL DEFAULT now(),
    aggregate_version       INT                     NOT NULL DEFAULT 1,

    CONSTRAINT tblAmlScreening_pk               PRIMARY KEY (screening_id),
    CONSTRAINT tblAmlScreening_adjudicated_by_fk
        FOREIGN KEY (adjudicated_by) REFERENCES tblAdminUser (admin_user_id),
    CONSTRAINT tblAmlScreening_adjudication_chk
        CHECK (
            (status = 'adjudicated'
                AND adjudication_decision IS NOT NULL
                AND adjudicated_by IS NOT NULL
                AND adjudicated_at IS NOT NULL)
            OR status <> 'adjudicated'
        ),
    CONSTRAINT tblAmlScreening_match_score_range
        CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 1))
);

COMMENT ON TABLE tblAmlScreening IS
    'BC11. AML/PEP screening record for investor, supplier, signatory, or UBO. '
    'One-time at onboarding in Phase 1; re-screening scheduler dormant (DL-037). '
    'Vendor payload stored verbatim in BC16 via vendor_payload_hash (C24). '
    'Refs: DL-037, DL-038, C24.';

COMMENT ON COLUMN tblAmlScreening.subject_type IS
    'investor | supplier | signatory | ubo — identifies which entity type '
    'the screening applies to.';
COMMENT ON COLUMN tblAmlScreening.vendor_payload_hash IS
    'SHA-256 reference into BC16 DocumentObject for the raw vendor AML response. '
    'Stored verbatim for evidence per C24.';

CREATE INDEX tblAmlScreening_subject_idx ON tblAmlScreening (subject_id, subject_type);
CREATE INDEX tblAmlScreening_status_idx  ON tblAmlScreening (status);

-- ---------------------------------------------------------------------------
-- tblSarCase
-- Internal Suspicious Activity Report. Status=internal only in Phase 1.
-- escalated_to_fiu_ind is a Phase 2 enum value.
-- ---------------------------------------------------------------------------
CREATE TABLE tblSarCase (
    sar_id              UUID        NOT NULL,
    subject_id          UUID        NOT NULL,  -- cross-context: investor_id or supplier_id.
    subject_type        aml_subject_type NOT NULL,
    -- status: 'internal' is the only active value in Phase 1.
    -- 'escalated_to_fiu_ind' is a Phase 2 value blocked by application.
    status              sar_status  NOT NULL DEFAULT 'internal',
    summary_doc_hash    BYTEA       NOT NULL,  -- SHA-256 ref → BC16.
    raised_by           UUID        NOT NULL,  -- FK → tblAdminUser (Compliance Reviewer).
    raised_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- updates: JSONB append-only log of {doc_hash, updated_by, updated_at}.
    updates             JSONB       NOT NULL DEFAULT '[]',
    aggregate_version   INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblSarCase_pk   PRIMARY KEY (sar_id),
    CONSTRAINT tblSarCase_raised_by_fk
        FOREIGN KEY (raised_by) REFERENCES tblAdminUser (admin_user_id)
);

COMMENT ON TABLE tblSarCase IS
    'BC11. Internal Suspicious Activity Report. Phase 1 status is always '
    '''internal''. ''escalated_to_fiu_ind'' is a Phase 2 enum value; application '
    'blocks it in Phase 1 (DL-038). Refs: DL-038.';

COMMENT ON COLUMN tblSarCase.status IS
    'Phase 1: internal only. escalated_to_fiu_ind is Phase 2 — '
    'the application command handler rejects that value until unlocked.';

CREATE INDEX tblSarCase_subject_idx ON tblSarCase (subject_id, subject_type);

-- ---------------------------------------------------------------------------
-- tblKycRefreshSchedule
-- Annual KYC refresh schedule. One per subject (UNIQUE on subject_id).
-- due_at is stored as activated_at + 12 months (C17).
-- ---------------------------------------------------------------------------
CREATE TABLE tblKycRefreshSchedule (
    schedule_id         UUID                NOT NULL,
    subject_id          UUID                NOT NULL,  -- investor_id or supplier_id.
    subject_type        kyc_subject_type    NOT NULL,
    -- due_at: stored computed value = activated_at + INTERVAL '12 months' (C17).
    due_at              TIMESTAMPTZ         NOT NULL,
    status              kyc_refresh_status  NOT NULL DEFAULT 'scheduled',
    window_close_at     TIMESTAMPTZ,   -- set when status transitions to due.
    completed_at        TIMESTAMPTZ,
    aggregate_version   INT                 NOT NULL DEFAULT 1,

    CONSTRAINT tblKycRefreshSchedule_pk         PRIMARY KEY (schedule_id),
    -- Scoped to (subject_id, subject_type) to allow an investor and a supplier
    -- to each have their own schedule (matching tblKycFile_subject_uq convention).
    CONSTRAINT tblKycRefreshSchedule_subject_uq UNIQUE (subject_id, subject_type)
);

COMMENT ON TABLE tblKycRefreshSchedule IS
    'BC11. Annual KYC refresh schedule. Exactly one per subject (UNIQUE). '
    'due_at = activated_at + 12 months stored as a computed value (C17). '
    'Missed refresh does not auto-suspend in Phase 1; Compliance Reviewer '
    'adjudicates (DL-037). Refs: C17, DL-037.';

COMMENT ON COLUMN tblKycRefreshSchedule.due_at IS
    'Stored computed value: activated_at + INTERVAL ''12 months'' (C17). '
    'Must be set at Schedule command time; scheduler fires KycRefresh.Due '
    'at this timestamp.';

CREATE INDEX tblKycRefreshSchedule_due_at_idx
    ON tblKycRefreshSchedule (due_at) WHERE status IN ('scheduled', 'due');

-- ---------------------------------------------------------------------------
-- tblKycFile
-- BC11 approval view. One per (subject_id, subject_type).
-- Approver must be a Compliance Reviewer — application invariant (C21, KF.1).
-- ---------------------------------------------------------------------------
CREATE TABLE tblKycFile (
    kyc_file_id         UUID                NOT NULL,
    subject_id          UUID                NOT NULL,  -- investor_id or supplier_id.
    subject_type        kyc_subject_type    NOT NULL,
    -- doc_hashes: array of SHA-256 refs into BC16 (one per submitted document).
    doc_hashes          BYTEA[]             NOT NULL DEFAULT '{}',
    status              kyc_file_status     NOT NULL DEFAULT 'in_review',
    -- approver_id: FK → tblAdminUser; must hold compliance_reviewer role.
    approver_id         UUID,
    decided_at          TIMESTAMPTZ,
    rejection_reason    TEXT,
    submitted_at        TIMESTAMPTZ         NOT NULL DEFAULT now(),
    aggregate_version   INT                 NOT NULL DEFAULT 1,

    CONSTRAINT tblKycFile_pk            PRIMARY KEY (kyc_file_id),
    CONSTRAINT tblKycFile_subject_uq    UNIQUE (subject_id, subject_type),
    CONSTRAINT tblKycFile_approver_fk
        FOREIGN KEY (approver_id) REFERENCES tblAdminUser (admin_user_id),
    CONSTRAINT tblKycFile_decision_chk
        CHECK (
            (status = 'in_review'
                AND approver_id IS NULL
                AND decided_at IS NULL)
            OR (status IN ('approved', 'rejected')
                AND approver_id IS NOT NULL
                AND decided_at IS NOT NULL)
        ),
    CONSTRAINT tblKycFile_rejection_reason_chk
        CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);

COMMENT ON TABLE tblKycFile IS
    'BC11. KYC file — approval lens. Exactly one per (subject_id, subject_type). '
    'Approver must hold the compliance_reviewer role — application-layer invariant '
    '(KF.1, C21). The approver cannot be the same individual who submitted on '
    'behalf of the supplier (record-level maker-checker, C4). '
    'Refs: DL-050, C4, C21.';

COMMENT ON COLUMN tblKycFile.approver_id IS
    'FK → tblAdminUser. Must hold compliance_reviewer role. '
    'Cannot be the same individual as the submitter — application-layer invariant '
    '(record-level maker-checker, C4).';

-- APPLICATION-LAYER INVARIANTS: tblKycFile
-- KF.1  approver_id must reference an admin_user with an active
--       compliance_reviewer RoleAssignment.
-- KF.2  For supplier KYC files, approver_id must differ from the admin_user
--       who submitted on the supplier's behalf (maker-checker, C4).
-- KF.3  KycFile.Approved is the only event that allows the corresponding BC7/BC8
--       account to advance to the MAA/MIA signing stage (DL-050).

CREATE INDEX tblKycFile_subject_idx ON tblKycFile (subject_id, subject_type);
CREATE INDEX tblKycFile_status_idx  ON tblKycFile (status) WHERE status = 'in_review';

-- ---------------------------------------------------------------------------
-- tblSpotCheck
-- Compliance audit-trail spot check record. Immutable after creation (C1).
-- ---------------------------------------------------------------------------
CREATE TABLE tblSpotCheck (
    spot_check_id       UUID        NOT NULL,
    period              TEXT        NOT NULL,   -- e.g. '2024-Q1'.
    scope               TEXT        NOT NULL,
    findings_doc_hash   BYTEA       NOT NULL,   -- SHA-256 ref → BC16.
    completed_by        UUID        NOT NULL,   -- FK → tblAdminUser (Compliance Reviewer).
    completed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    aggregate_version   INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblSpotCheck_pk PRIMARY KEY (spot_check_id),
    CONSTRAINT tblSpotCheck_completed_by_fk
        FOREIGN KEY (completed_by) REFERENCES tblAdminUser (admin_user_id)
);

COMMENT ON TABLE tblSpotCheck IS
    'BC11. Audit-trail spot-check record. Immutable after creation (C1). '
    'Ref: Spec §7.1.';

CREATE INDEX tblSpotCheck_period_idx ON tblSpotCheck (period);


-- =============================================================================
-- BC12 — TAX & REPORTING
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tblTaxYearProfile
-- Composite PK (investor_id, fy_code). One per investor per financial year.
-- Stores TDS rate determination inputs and cumulative figures for the FY.
-- ---------------------------------------------------------------------------
CREATE TABLE tblTaxYearProfile (
    investor_id                 UUID        NOT NULL,  -- FK → tblInvestorAccount.
    -- fy_code: e.g. 'FY2024-25'.
    fy_code                     TEXT        NOT NULL,
    -- tds_rate_bps: applicable TDS rate in basis points for this investor × FY.
    tds_rate_bps                INT         NOT NULL DEFAULT 0
        CONSTRAINT tblTaxYearProfile_tds_rate_positive CHECK (tds_rate_bps >= 0),
    -- pan_verified: whether PAN was verified at rate-resolution time.
    pan_verified                BOOLEAN     NOT NULL DEFAULT FALSE,
    -- cumulative_gross_paise: running sum of gross distributions in the FY.
    cumulative_gross_paise      money_paise NOT NULL DEFAULT 0,
    -- cumulative_tds_paise: running sum of TDS deducted in the FY.
    cumulative_tds_paise        money_paise NOT NULL DEFAULT 0,
    form_16a_issued             BOOLEAN     NOT NULL DEFAULT FALSE,
    form_16a_doc_hash           BYTEA,
    form_16a_issued_at          TIMESTAMPTZ,
    fy_closed_at                TIMESTAMPTZ,
    aggregate_version           INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblTaxYearProfile_pk PRIMARY KEY (investor_id, fy_code)
);

COMMENT ON TABLE tblTaxYearProfile IS
    'BC12. TDS tax year profile for an investor. Composite PK (investor_id, fy_code). '
    'One row per investor per financial year. Stores resolved TDS rate and '
    'cumulative totals for Form 16A issuance. Refs: DL-045, G4, G12.';

COMMENT ON COLUMN tblTaxYearProfile.tds_rate_bps IS
    'Resolved TDS rate in basis points (e.g. 1000 = 10%). Zero for exempt investors.';
COMMENT ON COLUMN tblTaxYearProfile.fy_code IS
    'Financial year code, e.g. ''FY2024-25''. Format enforced by application.';

CREATE INDEX tblTaxYearProfile_investor_idx ON tblTaxYearProfile (investor_id);

-- ---------------------------------------------------------------------------
-- tblTdsDeduction
-- Per-investor, per-listing TDS deduction record. Linked to a payout
-- instruction. Invariant: gross - tds_amount - fee_paise = net_paise.
-- ---------------------------------------------------------------------------
CREATE TABLE tblTdsDeduction (
    tds_deduction_id        UUID        NOT NULL,
    investor_id             UUID        NOT NULL,  -- FK → tblInvestorAccount.
    -- listing_id: cross-context reference to BC1 Listing.
    listing_id              UUID        NOT NULL,
    fy_code                 TEXT        NOT NULL,
    -- payout_instruction_id: FK → BC4 tblPayoutInstruction (cross-context by identity).
    payout_instruction_id   UUID        NOT NULL,
    -- challan_ref: escrow TDS challan reference once deposited (G12).
    challan_ref             TEXT,
    gross_paise             positive_money_paise NOT NULL,
    tds_amount_paise        money_paise          NOT NULL DEFAULT 0,
    fee_paise               money_paise          NOT NULL DEFAULT 0,
    net_paise               positive_money_paise NOT NULL,
    -- Invariant: gross - tds_amount - fee = net.
    CONSTRAINT tblTdsDeduction_net_formula_chk
        CHECK (net_paise = gross_paise - tds_amount_paise - fee_paise),
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    aggregate_version       INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblTdsDeduction_pk PRIMARY KEY (tds_deduction_id)
);

COMMENT ON TABLE tblTdsDeduction IS
    'BC12. Per-investor per-listing TDS deduction record. '
    'CHECK enforces: gross - tds_amount - fee = net_paise. '
    'payout_instruction_id FK links to BC4 PayoutInstruction. '
    'challan_ref populated on TdsChallanRecorded event from BC4. '
    'Refs: DL-045, G4, G12.';

COMMENT ON COLUMN tblTdsDeduction.net_paise IS
    'Net payout to investor in paise. Must equal gross - tds_amount - fee '
    '(enforced by CHECK constraint).';
COMMENT ON COLUMN tblTdsDeduction.challan_ref IS
    'Escrow TDS challan reference. Set when BC4 emits TdsChallanRecorded. '
    'Used for Form 16A generation (G12).';

CREATE INDEX tblTdsDeduction_investor_listing_idx ON tblTdsDeduction (investor_id, listing_id);
CREATE INDEX tblTdsDeduction_investor_fy_idx      ON tblTdsDeduction (investor_id, fy_code);
CREATE INDEX tblTdsDeduction_payout_instruction_idx ON tblTdsDeduction (payout_instruction_id);

-- ---------------------------------------------------------------------------
-- tblInvestorStatement
-- Composite PK (investor_id, period, kind). One per investor per period/kind.
-- kind: monthly_portfolio | form_16a.
-- ---------------------------------------------------------------------------
CREATE TABLE tblInvestorStatement (
    investor_id         UUID                        NOT NULL,  -- FK → tblInvestorAccount.
    -- period: 'YYYY-MM' for monthly_portfolio; 'FY20XX-XX' for form_16a.
    period              TEXT                        NOT NULL,
    kind                investor_statement_kind     NOT NULL,
    -- doc_hash: SHA-256 ref into BC16 for the generated statement document.
    doc_hash            BYTEA                       NOT NULL,
    generated_at        TIMESTAMPTZ                 NOT NULL DEFAULT now(),
    aggregate_version   INT                         NOT NULL DEFAULT 1,

    CONSTRAINT tblInvestorStatement_pk PRIMARY KEY (investor_id, period, kind)
);

COMMENT ON TABLE tblInvestorStatement IS
    'BC12. Investor statement. Composite PK (investor_id, period, kind). '
    'kind=monthly_portfolio generated on monthly cycle. '
    'kind=form_16a generated annually per DL-045, G12. '
    'doc_hash is a SHA-256 reference into BC16 DocumentObject. '
    'Refs: DL-045, Spec §2.4, G12.';

COMMENT ON COLUMN tblInvestorStatement.period IS
    'YYYY-MM for monthly_portfolio statements. '
    'FY20XX-XX format for form_16a statements.';

CREATE INDEX tblInvestorStatement_investor_idx ON tblInvestorStatement (investor_id, kind);


-- =============================================================================
-- BC13 — AUDITOR ACCESS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tblAccessScope
-- Defines the scope for an auditor engagement: date range, entity types,
-- sensitivity level. Immutable after first use.
-- ---------------------------------------------------------------------------
CREATE TABLE tblAccessScope (
    scope_id            UUID        NOT NULL,
    -- date_range: TSTZRANGE covering the audit period (ASC.1).
    date_range          TSTZRANGE   NOT NULL
        CONSTRAINT tblAccessScope_date_range_valid CHECK (NOT isempty(date_range)),
    -- entity_types: TEXT[] of aggregate/entity type names in scope.
    entity_types        TEXT[]      NOT NULL,
    -- sensitivity_level: highest sensitivity level accessible under this scope.
    sensitivity_level   auditor_sensitivity_level NOT NULL,
    defined_by          UUID        NOT NULL,  -- FK → tblAdminUser (Super Admin).
    defined_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- first_used_at: set when first referenced by an AuditorAccount.
    -- Once set, scope is immutable (ASC.2).
    first_used_at       TIMESTAMPTZ,
    aggregate_version   INT         NOT NULL DEFAULT 1,

    CONSTRAINT tblAccessScope_pk PRIMARY KEY (scope_id),
    CONSTRAINT tblAccessScope_defined_by_fk
        FOREIGN KEY (defined_by) REFERENCES tblAdminUser (admin_user_id)
);

COMMENT ON TABLE tblAccessScope IS
    'BC13. Access scope definition for an auditor engagement. Immutable after '
    'first use (first_used_at IS NOT NULL → no further mutations). '
    'date_range is a TSTZRANGE covering the audit period. '
    'Refs: C19, DL-039, DL-041.';

COMMENT ON COLUMN tblAccessScope.date_range IS
    'TSTZRANGE covering the period the auditor may access data for. '
    'Must satisfy: lower(date_range) ≤ upper(date_range) and within '
    'retention window — application-layer invariant (ASC.1).';
COMMENT ON COLUMN tblAccessScope.entity_types IS
    'TEXT[] of aggregate/entity type names the auditor may access '
    '(e.g. ARRAY[''InvestorAccount'',''Listing'']).';
COMMENT ON COLUMN tblAccessScope.first_used_at IS
    'Set atomically when an AuditorAccount first references this scope. '
    'Once set, scope is immutable (ASC.2) — application-layer invariant.';

-- APPLICATION-LAYER INVARIANTS: tblAccessScope
-- ASC.1  lower(date_range) ≤ upper(date_range) and the range must fall within
--        the 10-year retention window (C1).
-- ASC.2  Once first_used_at IS NOT NULL, no UPDATE on any other column is
--        permitted.  Changes require defining a new AccessScope.

CREATE INDEX tblAccessScope_defined_by_idx ON tblAccessScope (defined_by);

-- ---------------------------------------------------------------------------
-- tblAuditorAccount
-- Just-in-time, time-bound, scoped auditor account. Carries identity_id FK.
-- Proposed by Super Admin; approved by Compliance Reviewer (G21).
-- valid_until: account auto-disables at this timestamp (C19).
-- ---------------------------------------------------------------------------
CREATE TABLE tblAuditorAccount (
    auditor_account_id  UUID                    NOT NULL,
    -- identity_id: FK → tblIdentity. One auditor account per identity.
    identity_id         UUID                    NOT NULL,
    email               TEXT                    NOT NULL,
    scope_id            UUID                    NOT NULL,  -- FK → tblAccessScope.
    -- valid_until: scheduler fires AutoDisable at this timestamp.
    valid_until         TIMESTAMPTZ             NOT NULL,
    status              auditor_account_status  NOT NULL DEFAULT 'proposed',
    proposed_by         UUID                    NOT NULL,  -- FK → tblAdminUser (Super Admin).
    proposed_at         TIMESTAMPTZ             NOT NULL DEFAULT now(),
    -- approved_by: FK → tblAdminUser; must hold compliance_reviewer role; ≠ proposed_by.
    approved_by         UUID,
    approved_at         TIMESTAMPTZ,
    activated_at        TIMESTAMPTZ,
    auto_disabled_at    TIMESTAMPTZ,
    aggregate_version   INT                     NOT NULL DEFAULT 1,

    CONSTRAINT tblAuditorAccount_pk             PRIMARY KEY (auditor_account_id),
    CONSTRAINT tblAuditorAccount_identity_uq    UNIQUE (identity_id),
    CONSTRAINT tblAuditorAccount_scope_fk
        FOREIGN KEY (scope_id) REFERENCES tblAccessScope (scope_id),
    CONSTRAINT tblAuditorAccount_proposed_by_fk
        FOREIGN KEY (proposed_by) REFERENCES tblAdminUser (admin_user_id),
    CONSTRAINT tblAuditorAccount_approved_by_fk
        FOREIGN KEY (approved_by) REFERENCES tblAdminUser (admin_user_id),
    CONSTRAINT tblAuditorAccount_approved_chk
        CHECK (
            (status = 'proposed'
                AND approved_by IS NULL AND approved_at IS NULL)
            OR (status IN ('approved', 'activated', 'auto_disabled')
                AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
        ),
    CONSTRAINT tblAuditorAccount_maker_checker_chk
        CHECK (proposed_by <> approved_by OR approved_by IS NULL),
    CONSTRAINT tblAuditorAccount_valid_until_chk
        CHECK (valid_until > proposed_at)
);

COMMENT ON TABLE tblAuditorAccount IS
    'BC13. Just-in-time auditor account. Proposed by Super Admin; approved by '
    'Compliance Reviewer (≠ proposer — record-level maker-checker G21, C4). '
    'valid_until: scheduler fires AutoDisable at this timestamp (C19). '
    'AuditorAccount identity CANNOT share identity_id with any operational '
    'role-holder (admin user with active RoleAssignment) — application-layer '
    'invariant (C19). Refs: G21, C4, C19, DL-039.';

COMMENT ON COLUMN tblAuditorAccount.valid_until IS
    'Timestamp at which the scheduler deterministically fires AutoDisable. '
    'Status transitions to auto_disabled at this time (C19).';
COMMENT ON COLUMN tblAuditorAccount.approved_by IS
    'FK → tblAdminUser; must hold compliance_reviewer role. '
    'Must differ from proposed_by (maker-checker G21). '
    'Enforced by CHECK constraint and application handler.';

-- APPLICATION-LAYER INVARIANTS: tblAuditorAccount
-- AA13.1  proposed_by must hold an active super_admin RoleAssignment.
-- AA13.2  approved_by must hold an active compliance_reviewer RoleAssignment
--         and must differ from proposed_by (maker-checker G21).
-- AA13.3  AuditorAccount identity_id must NOT be the same as any
--         tblAdminUser.identity_id that has at least one active RoleAssignment
--         (account-level SoD, C19).  The handler cross-checks tblAdminUser
--         and tblRoleAssignment at Approve command time.
-- AA13.4  AutoDisable fires deterministically at valid_until; status becomes
--         terminal (auto_disabled). No further state transitions allowed.
-- AA13.5  Every auditor read and export must emit AuditorRead.Performed or
--         AuditorExport.Performed envelope before returning data (C3, DL-039).
-- AA13.6  Export volume is bounded; exceeding the rate limit emits
--         AuditorRateLimit.Triggered and blocks the export (C19).

CREATE INDEX tblAuditorAccount_identity_idx    ON tblAuditorAccount (identity_id);
CREATE INDEX tblAuditorAccount_status_idx      ON tblAuditorAccount (status);
CREATE INDEX tblAuditorAccount_valid_until_idx ON tblAuditorAccount (valid_until)
    WHERE status = 'activated';
CREATE INDEX tblAuditorAccount_scope_idx       ON tblAuditorAccount (scope_id);

-- =============================================================================
-- DEFERRED FK CONSTRAINTS
-- BC7/BC8/BC9 tables were created before tblAdminUser (BC10). These ALTER TABLE
-- statements add the remaining FKs now that all tables exist.
-- =============================================================================

-- BC7 backward references
ALTER TABLE tblInvestorInvite
    ADD CONSTRAINT tblInvestorInvite_issued_by_fk
        FOREIGN KEY (issued_by) REFERENCES tblAdminUser (admin_user_id);

ALTER TABLE tblInvestorAccount
    ADD CONSTRAINT tblInvestorAccount_kyc_approved_by_fk
        FOREIGN KEY (kyc_approved_by) REFERENCES tblAdminUser (admin_user_id);

-- BC8 backward references
ALTER TABLE tblSupplierAccount
    ADD CONSTRAINT tblSupplierAccount_kyc_approved_by_fk
        FOREIGN KEY (kyc_approved_by) REFERENCES tblAdminUser (admin_user_id);

ALTER TABLE tblAgencyConsent
    ADD CONSTRAINT tblAgencyConsent_revoked_by_fk
        FOREIGN KEY (revoked_by) REFERENCES tblAdminUser (admin_user_id);

-- BC9 backward references
ALTER TABLE tblBuyerAccount
    ADD CONSTRAINT tblBuyerAccount_nominated_by_fk
        FOREIGN KEY (nominated_by) REFERENCES tblAdminUser (admin_user_id);

ALTER TABLE tblAcknowledgmentUser
    ADD CONSTRAINT tblAcknowledgmentUser_designated_by_fk
        FOREIGN KEY (designated_by) REFERENCES tblAdminUser (admin_user_id);

ALTER TABLE tblPaymentInstruction
    ADD CONSTRAINT tblPaymentInstruction_confirmed_by_fk
        FOREIGN KEY (confirmed_by) REFERENCES tblAdminUser (admin_user_id);

-- BC10 intra-context backward reference
-- (tblRoleAssignment defined before tblDeviationEntry)
ALTER TABLE tblRoleAssignment
    ADD CONSTRAINT tblRoleAssignment_deviation_entry_fk
        FOREIGN KEY (deviation_register_entry_id)
            REFERENCES tblDeviationEntry (deviation_register_entry_id);

-- =============================================================================
-- END OF 02_counterparty_platform.sql
-- =============================================================================
