-- ============================================================
--  IRRIGATION PROJECT TRACKING SYSTEM — SUPABASE SQL SCHEMA
--  Run this in your Supabase project → SQL Editor → Run All
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     TEXT UNIQUE NOT NULL,
  project_name   TEXT NOT NULL,
  client         TEXT NOT NULL,
  location       TEXT,
  wo_number      TEXT NOT NULL,
  wo_date        DATE,
  wo_value       NUMERIC(18,2),
  status         TEXT DEFAULT 'Active'
                   CHECK (status IN ('Active','On Hold','Completed')),
  remarks        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. BOQ CONTRACT  (immutable after lock)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.boq_contract (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  boq_ref         TEXT NOT NULL,
  boq_section     TEXT,
  description     TEXT NOT NULL,
  category        TEXT DEFAULT 'Material'
                    CHECK (category IN ('Material','Installation','Earthwork','Equipment')),
  uom             TEXT NOT NULL,
  contract_qty    NUMERIC(18,3) NOT NULL,
  contract_rate   NUMERIC(18,2) NOT NULL,
  contract_value  NUMERIC(18,2) GENERATED ALWAYS AS (contract_qty * contract_rate) STORED,
  is_locked       BOOLEAN DEFAULT FALSE,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, boq_ref)
);

-- ============================================================
-- 3. BOQ SAP BREAKUP  (master execution key)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.boq_sap_breakup (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  parent_boq_ref  TEXT NOT NULL,
  sap_boq_ref     TEXT NOT NULL,
  material_code   TEXT,
  description     TEXT,
  uom             TEXT,
  required_qty    NUMERIC(18,3),
  rate            NUMERIC(18,2),
  value           NUMERIC(18,2) GENERATED ALWAYS AS (required_qty * rate) STORED,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, sap_boq_ref)
);

-- ============================================================
-- 4. MATERIAL MASTER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.material_master (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_code        TEXT UNIQUE NOT NULL,
  material_description TEXT NOT NULL,
  category             TEXT DEFAULT 'Raw'
                         CHECK (category IN ('Raw','Consumable','Equipment','Finished')),
  uom                  TEXT NOT NULL,
  active_status        BOOLEAN DEFAULT TRUE,
  remarks              TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. VENDOR MASTER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_master (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_code       TEXT UNIQUE NOT NULL,
  vendor_name       TEXT NOT NULL,
  category          TEXT DEFAULT 'Material'
                      CHECK (category IN ('Material','Service','Subcontract','Equipment')),
  contact_person    TEXT,
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  gst_no            TEXT,
  pan_no            TEXT,
  payment_terms     INT DEFAULT 30,
  performance_rating NUMERIC(3,1),
  active_status     BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. WAREHOUSE PLANNING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.warehouse_planning (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id               uuid REFERENCES projects(id) ON DELETE CASCADE,
  sap_boq_ref              TEXT NOT NULL,
  material_code            TEXT,
  warehouse_location       TEXT DEFAULT 'WH1',
  required_qty             NUMERIC(18,3) NOT NULL DEFAULT 0,
  available_warehouse_qty  NUMERIC(18,3) NOT NULL DEFAULT 0,
  reserved_qty             NUMERIC(18,3) NOT NULL DEFAULT 0,
  net_available_qty        NUMERIC(18,3) GENERATED ALWAYS AS
                             (available_warehouse_qty - reserved_qty) STORED,
  qty_to_procure           NUMERIC(18,3) GENERATED ALWAYS AS
                             (GREATEST(0, required_qty - (available_warehouse_qty - reserved_qty))) STORED,
  action_needed            TEXT GENERATED ALWAYS AS
                             (CASE WHEN (required_qty - (available_warehouse_qty - reserved_qty)) > 0
                                   THEN 'BUY' ELSE 'ISSUE' END) STORED,
  remarks                  TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. PURCHASE REQUEST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_request (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_no            TEXT UNIQUE NOT NULL,
  pr_date          DATE DEFAULT CURRENT_DATE,
  project_id       uuid REFERENCES projects(id) ON DELETE CASCADE,
  sap_boq_ref      TEXT NOT NULL,
  material_code    TEXT,
  pr_qty           NUMERIC(18,3) NOT NULL,
  uom              TEXT,
  required_date    DATE,
  priority         TEXT DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
  justification    TEXT,
  status           TEXT DEFAULT 'Draft'
                     CHECK (status IN ('Draft','Submitted','Approved','Rejected','PO Created')),
  requested_by     uuid,
  approved_by      uuid,
  approved_at      TIMESTAMPTZ,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. PURCHASE ORDER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_order (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_no             TEXT UNIQUE NOT NULL,
  po_date           DATE DEFAULT CURRENT_DATE,
  project_id        uuid REFERENCES projects(id) ON DELETE CASCADE,
  pr_ref            TEXT,
  sap_boq_ref       TEXT NOT NULL,
  material_code     TEXT,
  vendor_code       TEXT,
  po_qty            NUMERIC(18,3) NOT NULL,
  po_rate           NUMERIC(18,2) NOT NULL,
  tax_amount        NUMERIC(18,2) DEFAULT 0,
  freight_amount    NUMERIC(18,2) DEFAULT 0,
  total_po_value    NUMERIC(18,2) GENERATED ALWAYS AS
                      (po_qty * po_rate + tax_amount + freight_amount) STORED,
  expected_delivery DATE,
  po_status         TEXT DEFAULT 'Open' CHECK (po_status IN ('Open','Partial','Closed','Cancelled')),
  delivery_status   TEXT DEFAULT 'Pending' CHECK (delivery_status IN ('Pending','In Transit','Delivered','Partial')),
  remarks           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. GRN REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grn_register (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_no             TEXT UNIQUE NOT NULL,
  grn_date           DATE DEFAULT CURRENT_DATE,
  project_id         uuid REFERENCES projects(id) ON DELETE CASCADE,
  po_ref             TEXT,
  sap_boq_ref        TEXT,
  material_code      TEXT,
  received_qty       NUMERIC(18,3) NOT NULL,
  accepted_qty       NUMERIC(18,3) NOT NULL,
  rejected_qty       NUMERIC(18,3) GENERATED ALWAYS AS (received_qty - accepted_qty) STORED,
  inspection_status  TEXT DEFAULT 'Pending' CHECK (inspection_status IN ('Pending','Accepted','Rejected','Partial')),
  receipt_location   TEXT DEFAULT 'WH1',
  unit_rate          NUMERIC(18,2) DEFAULT 0,
  transport_cost     NUMERIC(18,2) DEFAULT 0,
  total_grn_value    NUMERIC(18,2) GENERATED ALWAYS AS
                       (accepted_qty * unit_rate + transport_cost) STORED,
  remarks            TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. WAREHOUSE STOCK  (running ledger — upserted by app)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.warehouse_stock (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id         uuid REFERENCES projects(id) ON DELETE CASCADE,
  material_code      TEXT NOT NULL,
  location           TEXT DEFAULT 'WH1',
  current_qty        NUMERIC(18,3) NOT NULL DEFAULT 0,
  weighted_avg_cost  NUMERIC(18,2) NOT NULL DEFAULT 0,
  last_updated       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, material_code, location)
);

-- ============================================================
-- 11. DC REGISTER  (Delivery Challans)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dc_register (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dc_no          TEXT UNIQUE NOT NULL,
  dc_date        DATE DEFAULT CURRENT_DATE,
  project_id     uuid REFERENCES projects(id) ON DELETE CASCADE,
  sap_boq_ref    TEXT NOT NULL,
  material_code  TEXT,
  dc_qty         NUMERIC(18,3) NOT NULL,
  from_location  TEXT DEFAULT 'WH1',
  to_site        TEXT,
  dc_status      TEXT DEFAULT 'Issued' CHECK (dc_status IN ('Issued','Received','Returned')),
  remarks        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. INSTALLATION EXECUTION
-- ============================================================
CREATE TABLE IF NOT EXISTS public.installation_execution (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id    TEXT UNIQUE NOT NULL,
  execution_date  DATE DEFAULT CURRENT_DATE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  boq_ref         TEXT NOT NULL,
  sap_boq_ref     TEXT NOT NULL,
  execution_type  TEXT DEFAULT 'Meter',
  executed_qty    NUMERIC(18,3) NOT NULL,
  rate            NUMERIC(18,2) DEFAULT 0,
  amount          NUMERIC(18,2) GENERATED ALWAYS AS (executed_qty * rate) STORED,
  resource_type   TEXT DEFAULT 'Labor' CHECK (resource_type IN ('Labor','Subcontract','Equipment')),
  supervisor      TEXT,
  certified_by    TEXT,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. LABOR & EQUIPMENT COST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.labor_equipment_cost (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id       TEXT UNIQUE NOT NULL,
  cost_date      DATE DEFAULT CURRENT_DATE,
  project_id     uuid REFERENCES projects(id) ON DELETE CASCADE,
  sap_boq_ref    TEXT,
  resource_type  TEXT DEFAULT 'Labor' CHECK (resource_type IN ('Labor','Equipment','Subcontract')),
  resource_name  TEXT NOT NULL,
  hours          NUMERIC(10,2),
  quantity       NUMERIC(10,2),
  rate           NUMERIC(18,2) NOT NULL,
  -- amount NOT generated — computed by trigger below (avoids immutability issue with COALESCE on nullable cols)
  amount         NUMERIC(18,2) DEFAULT 0,
  supervisor     TEXT,
  remarks        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to compute amount for labor_equipment_cost
CREATE OR REPLACE FUNCTION compute_lec_amount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.amount := COALESCE(NEW.hours, NEW.quantity, 0) * NEW.rate;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_lec_amount
BEFORE INSERT OR UPDATE ON labor_equipment_cost
FOR EACH ROW EXECUTE FUNCTION compute_lec_amount();

-- ============================================================
-- 14. INVOICE REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_register (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no      TEXT UNIQUE NOT NULL,
  invoice_date    DATE NOT NULL,
  invoice_type    TEXT DEFAULT 'Material' CHECK (invoice_type IN ('Material','Service')),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  boq_ref         TEXT,
  sap_boq_ref     TEXT,
  dc_ref          TEXT,
  billed_qty      NUMERIC(18,3) DEFAULT 0,
  rate            NUMERIC(18,2) DEFAULT 0,
  invoice_value   NUMERIC(18,2) GENERATED ALWAYS AS (billed_qty * rate) STORED,
  gst_amount      NUMERIC(18,2) DEFAULT 0,
  total_invoice   NUMERIC(18,2) GENERATED ALWAYS AS (billed_qty * rate + gst_amount) STORED,
  status          TEXT DEFAULT 'Draft'
                    CHECK (status IN ('Draft','Submitted','Certified','Paid','Disputed')),
  certified_date  DATE,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. PAYMENT TRACKER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_tracker (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id        TEXT UNIQUE NOT NULL,
  invoice_ref       TEXT,
  payment_date      DATE NOT NULL,
  payment_amount    NUMERIC(18,2) NOT NULL,
  payment_mode      TEXT DEFAULT 'Bank Transfer'
                      CHECK (payment_mode IN ('Bank Transfer','Cheque','Cash','UPI')),
  transaction_ref   TEXT,
  remarks           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. BUDGET
-- ============================================================
CREATE TABLE IF NOT EXISTS public.budget (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  cost_category   TEXT NOT NULL,
  budget_value    NUMERIC(18,2) NOT NULL,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. ACTUAL COST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.actual_cost (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  cost_type    TEXT NOT NULL,
  amount       NUMERIC(18,2) NOT NULL,
  reference_id TEXT,
  cost_date    DATE DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. ALERT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alert_log (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  severity      TEXT DEFAULT 'Medium' CHECK (severity IN ('High','Medium','Low')),
  message       TEXT NOT NULL,
  sap_boq_ref   TEXT,
  resolved      BOOLEAN DEFAULT FALSE,
  resolved_date TIMESTAMPTZ,
  resolved_by   uuid,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 19. CHANGE ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.change_order (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  co_no            TEXT UNIQUE NOT NULL,
  co_date          DATE DEFAULT CURRENT_DATE,
  project_id       uuid REFERENCES projects(id) ON DELETE CASCADE,
  boq_ref          TEXT,
  change_type      TEXT DEFAULT 'Addition' CHECK (change_type IN ('Addition','Deletion','Revision')),
  description      TEXT NOT NULL,
  qty_change       NUMERIC(18,3) NOT NULL DEFAULT 0,
  rate_change      NUMERIC(18,2) DEFAULT 0,
  value_impact     NUMERIC(18,2) GENERATED ALWAYS AS (qty_change * rate_change) STORED,
  approval_status  TEXT DEFAULT 'Draft'
                     CHECK (approval_status IN ('Draft','Submitted','Approved','Rejected')),
  approved_by      uuid,
  approved_at      TIMESTAMPTZ,
  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 20. DOCUMENT REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_register (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id          TEXT UNIQUE NOT NULL,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  doc_type        TEXT DEFAULT 'Drawing'
                    CHECK (doc_type IN ('Drawing','Approval','Certificate','Invoice','Report','Photo','Other')),
  doc_no          TEXT,
  description     TEXT NOT NULL,
  received_date   DATE,
  submitted_date  DATE,
  reference_id    TEXT,
  file_url        TEXT,
  file_name       TEXT,
  file_size       INT,
  mime_type       TEXT,
  status          TEXT DEFAULT 'Active',
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 21. SCHEDULE MILESTONES
--     NOTE: delay_days uses a trigger instead of GENERATED ALWAYS
--     because CURRENT_DATE is non-immutable and cannot be used
--     in a stored generated column in PostgreSQL.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedule_milestones (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_id        TEXT UNIQUE NOT NULL,
  project_id          uuid REFERENCES projects(id) ON DELETE CASCADE,
  boq_ref             TEXT,
  milestone_name      TEXT NOT NULL,
  planned_start       DATE NOT NULL,
  planned_finish      DATE NOT NULL,
  actual_start        DATE,
  actual_finish       DATE,
  completion_percent  NUMERIC(5,2) DEFAULT 0 CHECK (completion_percent BETWEEN 0 AND 100),
  delay_days          INT DEFAULT 0,   -- updated by trigger or app
  status              TEXT DEFAULT 'Not Started'
                        CHECK (status IN ('Not Started','In Progress','Completed','Delayed')),
  remarks             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-compute status + delay_days based on dates
CREATE OR REPLACE FUNCTION compute_milestone_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Compute delay_days
  IF NEW.actual_finish IS NOT NULL THEN
    NEW.delay_days := GREATEST(0, NEW.actual_finish - NEW.planned_finish);
  ELSE
    NEW.delay_days := GREATEST(0, CURRENT_DATE - NEW.planned_finish);
  END IF;

  -- Auto-set status if not explicitly set or on update
  IF NEW.completion_percent >= 100 THEN
    NEW.status := 'Completed';
  ELSIF NEW.delay_days > 0 AND NEW.completion_percent < 100 THEN
    NEW.status := 'Delayed';
  ELSIF NEW.completion_percent > 0 THEN
    NEW.status := 'In Progress';
  ELSE
    NEW.status := 'Not Started';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_milestone_status
BEFORE INSERT OR UPDATE ON schedule_milestones
FOR EACH ROW EXECUTE FUNCTION compute_milestone_status();

-- ============================================================
-- 22. VIEWS
-- ============================================================

-- BOQ Tracker View (chain of custody: PO → DC → Install → Bill)
CREATE OR REPLACE VIEW public.boq_tracker AS
SELECT
  b.project_id,
  b.boq_ref,
  b.description,
  b.uom,
  b.contract_qty,
  b.contract_rate,
  b.contract_value,
  COALESCE(SUM(po.po_qty), 0)                        AS po_qty,
  COALESCE(SUM(dc.dc_qty), 0)                        AS dc_qty,
  COALESCE(SUM(ie.executed_qty), 0)                  AS installed_qty,
  COALESCE(SUM(inv.billed_qty), 0)                   AS billed_qty,
  b.contract_qty - COALESCE(SUM(po.po_qty), 0)       AS balance_to_procure,
  b.contract_qty - COALESCE(SUM(ie.executed_qty), 0) AS balance_to_execute,
  COALESCE(SUM(ie.executed_qty), 0)
    - COALESCE(SUM(inv.billed_qty), 0)               AS balance_to_bill,
  CASE WHEN COALESCE(SUM(ie.executed_qty), 0) - COALESCE(SUM(inv.billed_qty), 0) > 0
       THEN 'MISSED BILL' ELSE 'OK' END              AS missed_bill_flag,
  CASE WHEN b.contract_qty > 0
       THEN ROUND((COALESCE(SUM(ie.executed_qty), 0) / b.contract_qty * 100)::NUMERIC, 2)
       ELSE 0 END                                    AS execution_percent,
  CASE WHEN COALESCE(SUM(ie.executed_qty), 0) > 0
       THEN ROUND((COALESCE(SUM(inv.billed_qty), 0) / COALESCE(SUM(ie.executed_qty), 0) * 100)::NUMERIC, 2)
       ELSE 0 END                                    AS billing_percent
FROM boq_contract b
LEFT JOIN boq_sap_breakup sap
  ON sap.parent_boq_ref = b.boq_ref AND sap.project_id = b.project_id
LEFT JOIN purchase_order po
  ON po.sap_boq_ref = sap.sap_boq_ref AND po.project_id = b.project_id
LEFT JOIN dc_register dc
  ON dc.sap_boq_ref = sap.sap_boq_ref AND dc.project_id = b.project_id
LEFT JOIN installation_execution ie
  ON ie.sap_boq_ref = sap.sap_boq_ref AND ie.project_id = b.project_id
LEFT JOIN invoice_register inv
  ON inv.boq_ref = b.boq_ref AND inv.project_id = b.project_id
  AND inv.status IN ('Certified','Paid')
GROUP BY b.id, b.project_id, b.boq_ref, b.description, b.uom,
         b.contract_qty, b.contract_rate, b.contract_value;

-- Budget vs Actual View
CREATE OR REPLACE VIEW public.budget_vs_actual AS
SELECT
  bud.project_id,
  bud.cost_category                             AS sap_boq_ref,
  bud.budget_value,
  COALESCE(act.actual_sum, 0)                   AS actual_value,
  bud.budget_value - COALESCE(act.actual_sum, 0) AS variance,
  CASE WHEN bud.budget_value > 0
       THEN ROUND(((bud.budget_value - COALESCE(act.actual_sum, 0)) / bud.budget_value)::NUMERIC, 4)
       ELSE 0 END                               AS variance_percent,
  CASE WHEN COALESCE(act.actual_sum, 0) > bud.budget_value THEN 'Over Budget'
       WHEN COALESCE(act.actual_sum, 0) < bud.budget_value THEN 'Under Budget'
       ELSE 'On Budget' END                     AS status
FROM budget bud
LEFT JOIN (
  SELECT project_id, cost_type, SUM(amount) AS actual_sum
  FROM actual_cost
  GROUP BY project_id, cost_type
) act ON act.project_id = bud.project_id AND act.cost_type = bud.cost_category;

-- ============================================================
-- 23. ROW LEVEL SECURITY
-- ============================================================
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'projects','boq_contract','boq_sap_breakup','material_master','vendor_master',
    'warehouse_planning','purchase_request','purchase_order','grn_register',
    'warehouse_stock','dc_register','installation_execution','labor_equipment_cost',
    'invoice_register','payment_tracker','budget','actual_cost','alert_log',
    'change_order','document_register','schedule_milestones'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    -- Drop policy if exists to allow re-running this script
    EXECUTE format('DROP POLICY IF EXISTS "auth_all_%I" ON %I;', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "auth_all_%I" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      tbl, tbl
    );
  END LOOP;
END $$;
