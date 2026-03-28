-- ============================================================
-- ERP REALISTIC SEED DATA
-- Loads a connected dataset for output verification across the app
-- ============================================================

begin;

insert into public.customers (
    id, client_name, company_type, contact_person, phone, email, address,
    gst_no, payment_behavior, credit_period
) values
    ('10000000-0000-0000-0000-000000000001', 'Royal Greens Resort Pvt Ltd', 'private', 'Rahul Mehta', '+91-98230-11001', 'rahul.mehta@royalgreens.in', 'Pune, Maharashtra', '27AABCR1111L1Z5', 'Monthly against certification', 30),
    ('10000000-0000-0000-0000-000000000002', 'Maharashtra Stadium Authority', 'govt', 'Dr. S. Kulkarni', '+91-98230-11002', 'projects@msa.gov.in', 'Mumbai, Maharashtra', '27AAAGM2222M1Z7', 'Milestone based', 45),
    ('10000000-0000-0000-0000-000000000003', 'GreenEdge Sports Consultants', 'consultant', 'Anita Shah', '+91-98230-11003', 'anita@greenedge.co.in', 'Nashik, Maharashtra', '27AAFCG3333N1Z2', 'Advance + stage release', 15),
    ('10000000-0000-0000-0000-000000000004', 'Blue Hills Turf Management LLP', 'private', 'Vikram Joshi', '+91-98230-11004', 'vikram@bluehills.in', 'Satara, Maharashtra', '27AAKFB4444P1Z9', 'Strict 30 day credit', 30)
on conflict (id) do nothing;

insert into public.materials (
    id, code, description, category, uom, standard_cost
) values
    ('30000000-0000-0000-0000-000000000001', 'MAT-PIPE-110', 'HDPE Pipe PN10 110mm', 'raw', 'm', 880.00),
    ('30000000-0000-0000-0000-000000000002', 'MAT-VALVE-80', '80mm Irrigation Valve Chamber Assembly', 'finished', 'nos', 12500.00),
    ('30000000-0000-0000-0000-000000000003', 'MAT-CABLE-6', '6 Core Armoured Control Cable', 'consumable', 'm', 45.00),
    ('30000000-0000-0000-0000-000000000004', 'MAT-CTRL-4', '4 Zone Controller Panel', 'equipment', 'set', 55000.00),
    ('30000000-0000-0000-0000-000000000005', 'MAT-PUMP-7.5', '7.5 HP Centrifugal Pump Set', 'equipment', 'set', 185000.00)
on conflict (code) do nothing;

insert into public.material_master (
    id, material_code, material_description, category, uom, active_status, remarks
) values
    ('70000000-0000-0000-0000-000000000001', 'MAT-PIPE-110', 'HDPE Pipe PN10 110mm', 'Raw', 'm', true, 'Primary mainline pipe'),
    ('70000000-0000-0000-0000-000000000002', 'MAT-VALVE-80', '80mm Irrigation Valve Chamber Assembly', 'Finished', 'nos', true, 'Valve chamber package'),
    ('70000000-0000-0000-0000-000000000003', 'MAT-CABLE-6', '6 Core Armoured Control Cable', 'Consumable', 'm', true, 'Control wiring'),
    ('70000000-0000-0000-0000-000000000004', 'MAT-CTRL-4', '4 Zone Controller Panel', 'Equipment', 'set', true, 'Automation panel')
on conflict (material_code) do nothing;

insert into public.vendors (
    id, name, type, contact_person, phone, email, address, payment_terms, gst_no
) values
    ('40000000-0000-0000-0000-000000000001', 'HydroFlow Systems Pvt Ltd', 'manufacturer', 'Nilesh Patil', '+91-98230-22001', 'sales@hydroflow.in', 'Pune, Maharashtra', '30 days', '27AABCH5555A1Z1'),
    ('40000000-0000-0000-0000-000000000002', 'Precision Irrigation Traders', 'dealer', 'Megha Rao', '+91-98230-22002', 'orders@precisionirrigation.in', 'Aurangabad, Maharashtra', '45 days', '27AAICP6666B1Z4'),
    ('40000000-0000-0000-0000-000000000003', 'TurfTech Equipment Co', 'retailer', 'Sandeep Kulkarni', '+91-98230-22003', 'info@turftech.co.in', 'Nagpur, Maharashtra', 'advance', '27AAFTT7777C1Z8')
on conflict (name) do nothing;

insert into public.vendor_master (
    id, vendor_code, vendor_name, category, contact_person, phone, email, address, gst_no, pan_no, payment_terms, performance_rating, active_status
) values
    ('71000000-0000-0000-0000-000000000001', 'VEND-HF', 'HydroFlow Systems Pvt Ltd', 'Material', 'Nilesh Patil', '+91-98230-22001', 'sales@hydroflow.in', 'Pune, Maharashtra', '27AABCH5555A1Z1', 'AAACH5555A', 30, 4.8, true),
    ('71000000-0000-0000-0000-000000000002', 'VEND-PT', 'Precision Irrigation Traders', 'Material', 'Megha Rao', '+91-98230-22002', 'orders@precisionirrigation.in', 'Aurangabad, Maharashtra', '27AAICP6666B1Z4', 'AAICP6666B', 45, 4.5, true),
    ('71000000-0000-0000-0000-000000000003', 'VEND-TT', 'TurfTech Equipment Co', 'Equipment', 'Sandeep Kulkarni', '+91-98230-22003', 'info@turftech.co.in', 'Nagpur, Maharashtra', '27AAFTT7777C1Z8', 'AAFTT7777C', 15, 4.6, true)
on conflict (vendor_code) do nothing;

insert into public.vendor_brand_mapping (
    id, vendor_id, brand_name, dealer_type, territory
) values
    ('6c000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Hunter', 'Authorized', 'West'),
    ('6c000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Jain', 'Channel Partner', 'Central'),
    ('6c000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'Toro', 'Retail', 'Pan India')
on conflict do nothing;

insert into public.vendor_prices (
    id, vendor_id, material_code, base_price, discount
) values
    ('6d000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'MAT-PIPE-110', 980.00, 30.00),
    ('6d000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'MAT-VALVE-80', 13000.00, 500.00),
    ('6d000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'MAT-CABLE-6', 48.00, 3.00),
    ('6d000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', 'MAT-CTRL-4', 56000.00, 2500.00)
on conflict (vendor_id, material_code) do nothing;

insert into public.labor_rates (
    id, category, skill_level, daily_rate
) values
    ('6f000000-0000-0000-0000-000000000001', 'Irrigation Crew', 'skilled', 1800.00),
    ('6f000000-0000-0000-0000-000000000002', 'Electrician', 'specialist', 2400.00),
    ('6f000000-0000-0000-0000-000000000003', 'Foreman', 'skilled', 2200.00),
    ('6f000000-0000-0000-0000-000000000004', 'Helper', 'unskilled', 900.00)
on conflict (category, skill_level) do nothing;

insert into public.projects (
    id, project_id, project_name, client, location, wo_number, wo_date, wo_value, status, remarks, created_by,
    name, description, start_date, end_date, progress, customer_id, project_type, scope_type, internal_owner_id
) values
    ('20000000-0000-0000-0000-000000000001', 'RGR-2026-01', 'Royal Greens Resort Irrigation Upgrade', 'Royal Greens Resort Pvt Ltd', 'Pune, Maharashtra', 'WO-2026-001', '2026-03-12', 0.00, 'enquiry', 'Concept stage irrigation estimate for a golf resort fairway and landscaping package.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'Royal Greens Resort Irrigation Upgrade', 'Concept stage irrigation estimate for a golf resort fairway and landscaping package.', '2026-04-01', null, 0, '10000000-0000-0000-0000-000000000001', 'golf', 'Concept + BOQ', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe'),
    ('20000000-0000-0000-0000-000000000002', 'SSA-2026-01', 'State Stadium Training Ground Works', 'Maharashtra Stadium Authority', 'Mumbai, Maharashtra', 'WO-2026-002', '2026-03-18', 0.00, 'upcoming', 'Upcoming cricket practice ground with drainage and pumping infrastructure.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'State Stadium Training Ground Works', 'Upcoming cricket practice ground with drainage and pumping infrastructure.', '2026-05-01', null, 0, '10000000-0000-0000-0000-000000000002', 'cricket', 'Tender ready', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe'),
    ('20000000-0000-0000-0000-000000000003', 'CSR-2026-01', 'City Stadium Cricket Ground Renovation', 'Maharashtra Stadium Authority', 'Nashik, Maharashtra', 'WO-2026-003', '2026-03-20', 3350000.00, 'enquiry', 'Primary execution project used for estimation, procurement, execution and billing flow.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'City Stadium Cricket Ground Renovation', 'Primary execution project used for estimation, procurement, execution and billing flow.', '2026-01-10', '2026-07-30', 0, '10000000-0000-0000-0000-000000000002', 'cricket', 'Detailed execution', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe'),
    ('20000000-0000-0000-0000-000000000004', 'SVF-2025-01', 'Sunset Valley Football Turf Modernization', 'Blue Hills Turf Management LLP', 'Satara, Maharashtra', 'WO-2025-010', '2025-02-14', 4800000.00, 'finished', 'Completed turf modernization package with handover records and billing closed out.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'Sunset Valley Football Turf Modernization', 'Completed turf modernization package with handover records and billing closed out.', '2025-03-01', '2025-12-20', 100, '10000000-0000-0000-0000-000000000004', 'football', 'Execution + handover', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe')
on conflict (id) do nothing;

insert into public.assets (
    id, asset_code, asset_name, asset_type, ownership, current_project_id
) values
    ('6e000000-0000-0000-0000-000000000001', 'AST-EXC-01', 'JCB 3DX Excavator', 'equipment', 'owned', '20000000-0000-0000-0000-000000000003'),
    ('6e000000-0000-0000-0000-000000000002', 'AST-TOOL-01', 'Laser Level Kit', 'tool', 'hired', null),
    ('6e000000-0000-0000-0000-000000000003', 'AST-TRN-01', 'Transit Mixer 7m3', 'equipment', 'owned', '20000000-0000-0000-0000-000000000004')
on conflict (asset_code) do nothing;

insert into public.project_members (
    id, project_id, user_id, role, joined_at
) values
    ('6b000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'admin', '2026-03-24T08:00:00Z'),
    ('6b000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'admin', '2026-03-24T08:00:00Z'),
    ('6b000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'admin', '2026-03-24T08:00:00Z'),
    ('6b000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'admin', '2026-03-24T08:00:00Z')
on conflict (project_id, user_id) do nothing;

insert into public.project_stages (
    id, project_id, name, description, sort_order, is_default, is_active
) values
    ('69000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Enquiry', 'Initial client discussion and scope capture.', 1, true, true),
    ('69000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'Design and BOQ', 'Design versioning and BOQ preparation.', 2, false, true),
    ('69000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Execution', 'Site execution and procurement.', 3, false, true),
    ('69000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'Billing', 'RA billing and payment follow-up.', 4, false, true)
on conflict (id) do nothing;

insert into public.interactions (
    id, project_id, interaction_date, mode, discussion_summary, action_required, responsible_person_id
) values
    ('6a000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-03-10T10:00:00Z', 'call', 'Discussed irrigation concept, rough cost band and site access.', 'Share concept sketch and budget estimate.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe'),
    ('6a000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '2026-03-15T14:30:00Z', 'meeting', 'Reviewed revised BOQ, commercial expectations and delivery timeline.', 'Revise quote and finalize IFC design.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe'),
    ('6a000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '2026-03-18T09:15:00Z', 'email', 'Tender clarifications received from consultant team.', 'Prepare compliance matrix.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe')
on conflict (id) do nothing;

insert into public.tasks (
    id, project_id, title, description, status, priority, assigned_to, due_date, completed_at, sort_order, created_by
) values
    ('68000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Survey and levels', 'Site survey and spot levels captured for the cricket ground.', 'done', 'high', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', '2026-02-01', '2026-02-01T12:00:00Z', 1, 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe'),
    ('68000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'Design review', 'Internal review of IFC package and BOQ alignment.', 'in_progress', 'medium', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', '2026-03-30', null, 2, 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe'),
    ('68000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Procurement follow-up', 'Follow up with vendor for pipe and controller delivery dates.', 'todo', 'high', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', '2026-04-05', null, 3, 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe')
on conflict (id) do nothing;

insert into public.designs (
    id, project_id, version_no, designer_id, design_type, approval_status, is_final_ifc, is_locked, finalized_at
) values
    ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'concept', 'submitted', false, false, null),
    ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 1, 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'concept', 'approved', false, false, null),
    ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 2, 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'ifc', 'submitted', false, false, null)
on conflict (project_id, version_no, design_type) do nothing;

insert into public.boq_headers (
    id, project_id, design_id, version_no, prepared_by, boq_date
) values
    ('51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 1, 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', '2026-03-22')
on conflict (project_id, design_id, version_no) do nothing;

insert into public.boq_lines (
    id, boq_header_id, line_no, material_id, description, category, qty, uom, rate, sap_breakup_required
) values
    ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 1, '30000000-0000-0000-0000-000000000001', '110mm HDPE mainline supply and laying', 'material', 1200.000, 'm', 1250.00, true),
    ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', 2, '30000000-0000-0000-0000-000000000002', 'RCC valve chamber and earthwork package', 'lumpsum', 12.000, 'nos', 48000.00, false),
    ('52000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', 3, '30000000-0000-0000-0000-000000000003', 'Control wiring, testing and commissioning', 'labor', 1.000, 'ls', 325000.00, true),
    ('52000000-0000-0000-0000-000000000004', '51000000-0000-0000-0000-000000000001', 4, '30000000-0000-0000-0000-000000000004', 'Controller and sensor package', 'material', 2.000, 'set', 285000.00, true)
on conflict (boq_header_id, line_no) do nothing;

insert into public.cost_components (
    id, boq_line_id, component_type, component_amount
) values
    ('53000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'material', 1320000.00),
    ('53000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'freight', 90000.00),
    ('53000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000001', 'margin', 90000.00),
    ('53000000-0000-0000-0000-000000000004', '52000000-0000-0000-0000-000000000002', 'labor', 420000.00),
    ('53000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000002', 'overheads', 60000.00),
    ('53000000-0000-0000-0000-000000000006', '52000000-0000-0000-0000-000000000002', 'margin', 96000.00),
    ('53000000-0000-0000-0000-000000000007', '52000000-0000-0000-0000-000000000003', 'labor', 250000.00),
    ('53000000-0000-0000-0000-000000000008', '52000000-0000-0000-0000-000000000003', 'overheads', 35000.00),
    ('53000000-0000-0000-0000-000000000009', '52000000-0000-0000-0000-000000000003', 'margin', 40000.00),
    ('53000000-0000-0000-0000-000000000010', '52000000-0000-0000-0000-000000000004', 'material', 450000.00),
    ('53000000-0000-0000-0000-000000000011', '52000000-0000-0000-0000-000000000004', 'freight', 40000.00),
    ('53000000-0000-0000-0000-000000000012', '52000000-0000-0000-0000-000000000004', 'margin', 80000.00)
on conflict (boq_line_id, component_type) do nothing;

insert into public.quotations (
    id, project_id, design_id, version_no, total_cost, quoted_value, validity_date, status
) values
    ('54000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 1, 2971000.00, 3350000.00, '2026-06-30', 'draft')
on conflict (project_id, version_no) do nothing;

insert into public.quotation_revisions (
    id, quotation_id, revision_no, previous_quoted_value, revised_quoted_value, commercial_impact, final_agreed_value, revision_reason, revised_by, revision_date
) values
    ('55000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001', 1, 3350000.00, 3275000.00, -75000.00, 3275000.00, 'Commercial negotiation after client budget review.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', '2026-03-23T11:30:00Z')
on conflict (quotation_id, revision_no) do nothing;

insert into public.negotiation_logs (
    id, quotation_id, discussion_date, discussion_summary, commercial_impact, proposed_value, agreed_value, next_action, logged_by
) values
    ('56000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001', '2026-03-22T09:45:00Z', 'Discussed scope split and payment milestones with client commercial team.', -50000.00, 3300000.00, 3275000.00, 'Issue revised proforma.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe'),
    ('56000000-0000-0000-0000-000000000002', '54000000-0000-0000-0000-000000000001', '2026-03-23T15:10:00Z', 'Final agreement reached after capex alignment and timeline confirmation.', 0.00, 3275000.00, 3275000.00, 'Move to execution handoff.', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe')
on conflict (id) do nothing;

update public.quotations
set status = 'approved',
    approved_at = coalesce(approved_at, now()),
    updated_at = now()
where id = '54000000-0000-0000-0000-000000000001';

insert into public.boq_contract (
    id, project_id, boq_ref, boq_section, description, category, uom, contract_qty, contract_rate, is_locked, remarks
) values
    ('57000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-001', 'Mainline', '110mm HDPE mainline supply and laying', 'Material', 'm', 1200.000, 1250.00, true, 'Locked from approved quotation'),
    ('57000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-002', 'Civil Works', 'RCC valve chamber and earthwork package', 'Earthwork', 'nos', 12.000, 48000.00, true, 'Locked from approved quotation'),
    ('57000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-003', 'Electrical', 'Control wiring, testing and commissioning', 'Installation', 'ls', 1.000, 325000.00, true, 'Locked from approved quotation'),
    ('57000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-004', 'Automation', 'Controller and sensor package', 'Equipment', 'set', 2.000, 285000.00, true, 'Locked from approved quotation')
on conflict (project_id, boq_ref) do nothing;

insert into public.boq_sap_breakup (
    id, project_id, parent_boq_ref, sap_boq_ref, material_code, description, uom, required_qty, rate, remarks
) values
    ('58000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-001', 'SAP-CR-001', 'MAT-PIPE-110', 'HDPE pipe mainline', 'm', 1200.000, 1250.00, 'Primary procurement bucket'),
    ('58000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-002', 'SAP-CR-002', 'MAT-VALVE-80', 'Valve chamber package', 'nos', 12.000, 48000.00, 'Civil and masonry package'),
    ('58000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-003', 'SAP-CR-003', 'MAT-CABLE-6', 'Control wiring', 'm', 1000.000, 325.00, 'Electrical procurement bucket'),
    ('58000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-004', 'SAP-CR-004', 'MAT-CTRL-4', 'Controller and sensor package', 'set', 2.000, 285000.00, 'Automation package')
on conflict (project_id, sap_boq_ref) do nothing;

insert into public.warehouse_planning (
    id, project_id, sap_boq_ref, material_code, warehouse_location, required_qty, available_warehouse_qty, reserved_qty, remarks
) values
    ('59000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'SAP-CR-001', 'MAT-PIPE-110', 'WH1', 1200.000, 300.000, 0.000, 'Mainline pipe shortage'),
    ('59000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'SAP-CR-002', 'MAT-VALVE-80', 'WH1', 12.000, 12.000, 0.000, 'Civil package stock available'),
    ('59000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'SAP-CR-003', 'MAT-CABLE-6', 'WH1', 1000.000, 150.000, 0.000, 'Cable procurement needed'),
    ('59000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'SAP-CR-004', 'MAT-CTRL-4', 'WH1', 2.000, 2.000, 0.000, 'Controller package available')
on conflict do nothing;

insert into public.purchase_request (
    id, pr_no, pr_date, project_id, sap_boq_ref, material_code, pr_qty, uom, required_date, priority, justification, status, requested_by, approved_by, approved_at, remarks
) values
    ('5a000000-0000-0000-0000-000000000001', 'PR-CR-001', '2026-03-24', '20000000-0000-0000-0000-000000000003', 'SAP-CR-001', 'MAT-PIPE-110', 600.000, 'm', '2026-04-05', 'High', 'Mainline pipe required for next site stretch.', 'Approved', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', '2026-03-24T09:00:00Z', 'Approved for PO creation'),
    ('5a000000-0000-0000-0000-000000000002', 'PR-CR-002', '2026-03-24', '20000000-0000-0000-0000-000000000003', 'SAP-CR-004', 'MAT-CTRL-4', 2.000, 'set', '2026-04-10', 'Medium', 'Controller package required for automation stage.', 'Submitted', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', null, null, 'Awaiting approval')
on conflict (pr_no) do nothing;

insert into public.purchase_order (
    id, po_no, po_date, pr_ref, project_id, sap_boq_ref, material_code, vendor_code, po_qty, po_rate, tax_amount, freight_amount, expected_delivery, po_status, delivery_status, remarks
) values
    ('5b000000-0000-0000-0000-000000000001', 'PO-CR-001', '2026-03-24', 'PR-CR-001', '20000000-0000-0000-0000-000000000003', 'SAP-CR-001', 'MAT-PIPE-110', 'VEND-HF', 600.000, 980.00, 17640.00, 12000.00, '2026-03-31', 'Open', 'In Transit', 'Released to HydroFlow Systems')
on conflict (po_no) do nothing;

insert into public.grn_register (
    id, grn_no, grn_date, project_id, po_ref, sap_boq_ref, material_code, received_qty, accepted_qty, inspection_status, receipt_location, unit_rate, transport_cost, remarks
) values
    ('5c000000-0000-0000-0000-000000000001', 'GRN-CR-001', '2026-03-25', '20000000-0000-0000-0000-000000000003', 'PO-CR-001', 'SAP-CR-001', 'MAT-PIPE-110', 600.000, 592.000, 'Partial', 'WH1', 980.00, 12000.00, '8 pipes rejected during inspection')
on conflict (grn_no) do nothing;

insert into public.warehouse_stock (
    id, project_id, material_code, location, current_qty, weighted_avg_cost, last_updated
) values
    ('5d000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'MAT-PIPE-110', 'WH1', 592.000, 980.00, '2026-03-25T12:00:00Z'),
    ('5d000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'MAT-VALVE-80', 'WH1', 12.000, 12500.00, '2026-03-25T12:00:00Z'),
    ('5d000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'MAT-CTRL-4', 'WH1', 2.000, 55000.00, '2026-03-25T12:00:00Z')
on conflict (project_id, material_code, location) do nothing;

insert into public.dc_register (
    id, dc_no, dc_date, project_id, sap_boq_ref, material_code, dc_qty, from_location, to_site, dc_status, remarks
) values
    ('5e000000-0000-0000-0000-000000000001', 'DC-CR-001', '2026-03-26', '20000000-0000-0000-0000-000000000003', 'SAP-CR-001', 'MAT-PIPE-110', 180.000, 'WH1', 'Site A', 'Issued', 'Mainline pipe dispatched to site'),
    ('5e000000-0000-0000-0000-000000000002', 'DC-CR-002', '2026-03-26', '20000000-0000-0000-0000-000000000003', 'SAP-CR-004', 'MAT-CTRL-4', 2.000, 'WH1', 'Site A', 'Issued', 'Automation package dispatched')
on conflict (dc_no) do nothing;

insert into public.installation_execution (
    id, execution_id, execution_date, project_id, boq_ref, sap_boq_ref, execution_type, executed_qty, rate, resource_type, supervisor, certified_by, remarks
) values
    ('5f000000-0000-0000-0000-000000000001', 'EX-CR-001', '2026-03-27', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-001', 'SAP-CR-001', 'Meter', 120.000, 1250.00, 'Labor', 'Arvind Patil', 'R. Deshmukh', 'Mainline laying certified'),
    ('5f000000-0000-0000-0000-000000000002', 'EX-CR-002', '2026-03-27', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-003', 'SAP-CR-003', 'LS', 1.000, 325000.00, 'Subcontract', 'Arvind Patil', 'R. Deshmukh', 'Electrical testing package'),
    ('5f000000-0000-0000-0000-000000000003', 'EX-CR-003', '2026-03-28', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-002', 'SAP-CR-002', 'Each', 4.000, 48000.00, 'Equipment', 'Arvind Patil', 'R. Deshmukh', 'Valve chambers executed')
on conflict (execution_id) do nothing;

insert into public.labor_equipment_cost (
    id, entry_id, cost_date, project_id, sap_boq_ref, resource_type, resource_name, hours, quantity, rate, supervisor, remarks
) values
    ('5f100000-0000-0000-0000-000000000001', 'LEC-CR-001', '2026-03-27', '20000000-0000-0000-0000-000000000003', 'SAP-CR-001', 'Labor', 'Crew A', 48.00, null, 2200.00, 'Arvind Patil', 'Crew charges for pipe laying'),
    ('5f100000-0000-0000-0000-000000000002', 'LEC-CR-002', '2026-03-27', '20000000-0000-0000-0000-000000000003', 'SAP-CR-003', 'Equipment', 'Excavator 3DX', null, 6.00, 8500.00, 'Arvind Patil', 'Excavator utilization'),
    ('5f100000-0000-0000-0000-000000000003', 'LEC-CR-003', '2026-03-28', '20000000-0000-0000-0000-000000000003', 'SAP-CR-002', 'Subcontract', 'Masonry Subcontract', null, 2.00, 12000.00, 'Arvind Patil', 'Valve chamber masonry')
on conflict (entry_id) do nothing;

insert into public.invoice_register (
    id, invoice_no, invoice_date, invoice_type, project_id, boq_ref, sap_boq_ref, dc_ref, billed_qty, rate, gst_amount, status, certified_date, remarks
) values
    ('60000000-0000-0000-0000-000000000001', 'INV-CR-001', '2026-03-29', 'Material', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-001', 'SAP-CR-001', 'DC-CR-001', 120.000, 1250.00, 27000.00, 'Certified', '2026-03-29', 'Certified for first running account'),
    ('60000000-0000-0000-0000-000000000002', 'INV-CR-002', '2026-03-29', 'Service', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-004', 'SAP-CR-004', 'DC-CR-002', 1.000, 285000.00, 51300.00, 'Paid', '2026-03-29', 'Automation package billed and paid')
on conflict (invoice_no) do nothing;

insert into public.payment_tracker (
    id, payment_id, invoice_ref, payment_date, payment_amount, payment_mode, transaction_ref, remarks
) values
    ('61000000-0000-0000-0000-000000000001', 'PAY-CR-001', 'INV-CR-002', '2026-03-30', 336300.00, 'Bank Transfer', 'UTR983421003', 'Final settlement for automation package')
on conflict (payment_id) do nothing;

insert into public.budget (
    id, project_id, cost_category, budget_value, remarks
) values
    ('62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Material', 1500000.00, 'Pipe and fittings budget'),
    ('62000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'Labor', 500000.00, 'Site crew and installation labor'),
    ('62000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Equipment', 375000.00, 'Pumps, controllers and hired machinery')
on conflict (id) do nothing;

insert into public.actual_cost (
    id, project_id, cost_type, amount, reference_id, cost_date
) values
    ('63000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Material', 617640.00, 'PO-CR-001', '2026-03-25'),
    ('63000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'Labor', 105600.00, 'LEC-CR-001', '2026-03-27'),
    ('63000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Equipment', 51000.00, 'LEC-CR-002', '2026-03-27'),
    ('63000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'Subcontract', 96000.00, 'EX-CR-002', '2026-03-28')
on conflict (id) do nothing;

insert into public.alert_log (
    id, project_id, category, severity, message, sap_boq_ref, resolved, resolved_date, resolved_by
) values
    ('64000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Procurement', 'High', 'Pipe delivery is behind the planned procurement date.', 'SAP-CR-001', false, null, null),
    ('64000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'Billing', 'Medium', 'Certified invoice awaiting reconciliation in accounts.', 'SAP-CR-001', true, '2026-03-30T10:15:00Z', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe'),
    ('64000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Execution', 'Low', 'Minor DC mismatch logged at site store and under review.', 'SAP-CR-004', false, null, null)
on conflict (id) do nothing;

insert into public.change_order (
    id, co_no, co_date, project_id, boq_ref, change_type, description, qty_change, rate_change, approval_status, approved_by, approved_at, remarks
) values
    ('65000000-0000-0000-0000-000000000001', 'CO-CR-001', '2026-03-28', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-001', 'Addition', 'Add extra irrigation heads near the spectator berm.', 8.000, 8500.00, 'Approved', 'cafa574e-fcef-493b-bbd9-c8b0992ad3fe', '2026-03-28T16:00:00Z', 'Commercially approved change order'),
    ('65000000-0000-0000-0000-000000000002', 'CO-CR-002', '2026-03-29', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-004', 'Revision', 'Controller layout revised after site coordination meeting.', 1.000, 42000.00, 'Submitted', null, null, 'Pending client approval')
on conflict (co_no) do nothing;

insert into public.document_register (
    id, doc_id, project_id, doc_type, doc_no, description, received_date, submitted_date, reference_id, file_url, file_name, file_size, mime_type, status, remarks
) values
    ('66000000-0000-0000-0000-000000000001', 'DOC-CR-001', '20000000-0000-0000-0000-000000000003', 'Drawing', 'IFC-2026-03', 'Approved IFC drawing set', '2026-03-22', '2026-03-22', 'DES-IFC-02', 'https://example.com/docs/ifc-2026-03.pdf', 'ifc-2026-03.pdf', 1245000, 'application/pdf', 'Active', 'Client accepted drawing pack'),
    ('66000000-0000-0000-0000-000000000002', 'DOC-CR-002', '20000000-0000-0000-0000-000000000003', 'Approval', 'LOA-2026-01', 'Letter of award from client', '2026-03-23', '2026-03-23', 'QTN-CR-001', 'https://example.com/docs/loa-2026-01.pdf', 'loa-2026-01.pdf', 512000, 'application/pdf', 'Active', 'Award document'),
    ('66000000-0000-0000-0000-000000000003', 'DOC-CR-003', '20000000-0000-0000-0000-000000000003', 'Report', 'MBR-2026-03', 'Monthly measurement and billing report', '2026-03-29', '2026-03-29', 'INV-CR-001', 'https://example.com/docs/mbr-2026-03.pdf', 'mbr-2026-03.pdf', 748000, 'application/pdf', 'Active', 'Prepared for certified billing')
on conflict (doc_id) do nothing;

insert into public.schedule_milestones (
    id, milestone_id, project_id, boq_ref, milestone_name, planned_start, planned_finish, actual_start, actual_finish, completion_percent, remarks
) values
    ('67000000-0000-0000-0000-000000000001', 'MS-CR-001', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-001', 'Survey and Layout', '2026-01-15', '2026-01-25', '2026-01-16', '2026-01-24', 100.00, 'Completed ahead of plan'),
    ('67000000-0000-0000-0000-000000000002', 'MS-CR-002', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-001', 'Design Freeze', '2026-01-26', '2026-02-10', '2026-01-27', '2026-02-12', 100.00, 'Minor delay in client approval'),
    ('67000000-0000-0000-0000-000000000003', 'MS-CR-003', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-004', 'Procurement', '2026-02-11', '2026-03-05', '2026-02-12', null, 60.00, 'Materials partially received'),
    ('67000000-0000-0000-0000-000000000004', 'MS-CR-004', '20000000-0000-0000-0000-000000000003', 'BOQ-CR-003', 'Execution and Billing', '2026-03-06', '2026-04-20', null, null, 15.00, 'Execution underway')
on conflict (milestone_id) do nothing;

update public.projects
set progress = 33.33,
    updated_at = now()
where id = '20000000-0000-0000-0000-000000000003';

commit;
