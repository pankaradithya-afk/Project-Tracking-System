-- ============================================================
--  SEED DATA — The Club Mahabaleshwar
--  Toro Automatic Irrigation System
--  Project Value : ₹ 45,78,000
--  Material      : ₹ 38,67,000
--  Installation  : ₹  7,11,000
--  Run this in Supabase → SQL Editor → Run All
-- ============================================================

-- ============================================================
-- STEP 1 — MATERIAL MASTER
-- ============================================================
INSERT INTO public.material_master (material_code, material_description, category, uom, active_status, remarks)
VALUES
  ('TORO-IC-6',   'Toro IC System 6-Station Controller',          'Equipment',   'Nos', true, 'Smart WiFi controller'),
  ('TORO-DRIPMT', 'Toro Drip Manifold Kit with Filter & PRV',     'Finished',    'Kit', true, 'Includes 1/2" manifold'),
  ('PIPE-HDPE-32','HDPE Pipe 32mm PN-6',                          'Raw',         'Mtr', true, 'Coil 100m'),
  ('PIPE-HDPE-63','HDPE Pipe 63mm PN-4',                          'Raw',         'Mtr', true, 'Coil 100m'),
  ('PIPE-HDPE-90','HDPE Pipe 90mm PN-4',                          'Raw',         'Mtr', true, 'Main distribution'),
  ('TORO-570Z-4', 'Toro 570Z Fixed-Arc Spray Head 4 inch',        'Finished',    'Nos', true, 'Pop-up spray head'),
  ('TORO-570Z-6', 'Toro 570Z Fixed-Arc Spray Head 6 inch',        'Finished',    'Nos', true, 'Pop-up spray head'),
  ('TORO-T5-360', 'Toro T5 Rotor Sprinkler 360° full-circle',     'Finished',    'Nos', true, 'Gear-drive rotor'),
  ('TORO-T7-ADJ', 'Toro T7 Rotor Sprinkler Adjustable Arc',       'Finished',    'Nos', true, 'Gear-drive rotor adj'),
  ('TORO-DL-DRIP','Toro Dripline 16mm 0.6 L/hr @ 30cm spacing',   'Finished',    'Mtr', true, 'Sub-surface drip'),
  ('BVLV-1IN',    'Ball Valve ISI 1 inch SS body',                 'Raw',         'Nos', true, 'Zone isolation valve'),
  ('SOLV-24V',    'Solenoid Valve 24VAC Normally Closed 1 inch',   'Finished',    'Nos', true, 'Zone control valve'),
  ('FILTER-Y-1IN','Y-Strainer Filter 1 inch 120 mesh',             'Raw',         'Nos', true, 'Media filter'),
  ('WIRE-2C18',   'Multi-core Control Cable 2-core 18AWG',         'Raw',         'Mtr', true, 'Controller wiring'),
  ('WIRE-7C18',   'Multi-core Control Cable 7-core 18AWG',         'Raw',         'Mtr', true, 'Multi-zone wiring'),
  ('FITTING-MISC','Miscellaneous HDPE Fittings (elbows, tees)',     'Consumable',  'Lot', true, 'As required per site'),
  ('CONDUIT-25',  'PVC Conduit Pipe 25mm dia',                     'Raw',         'Mtr', true, 'Cable protection'),
  ('PUMP-1HP',    'Water Pump 1 HP SS Submersible',                'Equipment',   'Nos', true, 'Boost pump for low zones'),
  ('SENSOR-RAIN', 'Rain / Freeze Sensor Wireless Toro',            'Equipment',   'Nos', true, 'Smart shutoff sensor'),
  ('VALVEBOX-SM', 'Valve Box Small 10x10 inch Green Plastic',      'Raw',         'Nos', true, 'Underground valve housing')
ON CONFLICT (material_code) DO NOTHING;

-- ============================================================
-- STEP 2 — VENDOR MASTER
-- ============================================================
INSERT INTO public.vendor_master
  (vendor_code, vendor_name, category, contact_person, phone, email, address, gst_no, pan_no, payment_terms, performance_rating, active_status)
VALUES
  ('VND-001','Toro India Pvt Ltd',              'Material',    'Rajesh Nair',    '9820112233', 'rajesh@toroindia.com',    'Mumbai, MH',            '27AAACT1234A1ZB', 'AAACT1234A', 30, 4.8, true),
  ('VND-002','AquaTech Pipes & Fittings',        'Material',    'Suresh Patil',   '9876543210', 'suresh@aquatech.in',     'Pune, MH',              '27AABCA5678B2ZC', 'AABCA5678B', 45, 4.3, true),
  ('VND-003','Maharashtra Cables & Wires',       'Material',    'Dinesh Kamble',  '9823456789', 'dinesh@mhcables.in',     'Satara, MH',            '27AACMA9012C3ZD', 'AACMA9012C', 30, 4.1, true),
  ('VND-004','GreenField Irrigation Services',   'Subcontract', 'Prakash Shinde', '9765432108', 'prakash@greenfield.com', 'Mahabaleshwar, MH',     '27AADGA3456D4ZE', 'AADGA3456D', 15, 4.5, true),
  ('VND-005','Hilltop Civil & Plumbing Works',   'Service',     'Mohan Jadhav',   '9654321097', 'mohan@hilltop.co.in',    'Wai, MH',               '27AACHA7890E5ZF', 'AACHA7890E', 15, 4.0, true)
ON CONFLICT (vendor_code) DO NOTHING;

-- ============================================================
-- STEP 3 — PROJECT
-- ============================================================
INSERT INTO public.projects
  (project_id, project_name, client, location, wo_number, wo_date, wo_value, status, remarks)
VALUES
  ('PRJ-2026-001',
   'Toro Automatic Irrigation System',
   'The Club Mahabaleshwar',
   'Mahabaleshwar, Dist. Satara, Maharashtra',
   'WO/CMH/2026/0021',
   '2026-01-15',
   4578000.00,
   'Active',
   'Full golf-course & landscape automatic irrigation using Toro IC system. Material: ₹38,67,000 | Installation: ₹7,11,000')
ON CONFLICT (project_id) DO NOTHING;

-- Store project UUID for subsequent inserts
DO $$
DECLARE
  p_id uuid;
BEGIN
  SELECT id INTO p_id FROM public.projects WHERE project_id = 'PRJ-2026-001';

  -- ----------------------------------------------------------
  -- STEP 4 — BOQ CONTRACT
  -- ----------------------------------------------------------
  INSERT INTO public.boq_contract
    (project_id, boq_ref, boq_section, description, category, uom, contract_qty, contract_rate, is_locked, remarks)
  VALUES
    -- Material BOQ items (total ~ 38,67,000)
    (p_id,'BOQ-01','Supply','Toro IC 6-Station Smart Controller','Material','Nos',8,18500,'false','Including installation kit'),
    (p_id,'BOQ-02','Supply','Toro Drip Manifold Kit','Material','Kit',25,4200,'false','1 kit per zone'),
    (p_id,'BOQ-03','Supply','HDPE Pipe 32mm PN-6','Material','Mtr',4200,65,'false','Lateral distribution'),
    (p_id,'BOQ-04','Supply','HDPE Pipe 63mm PN-4','Material','Mtr',1800,130,'false','Sub-main line'),
    (p_id,'BOQ-05','Supply','HDPE Pipe 90mm PN-4','Material','Mtr',900,220,'false','Main supply line'),
    (p_id,'BOQ-06','Supply','Toro 570Z 4-inch Spray Head','Material','Nos',480,560,'false','Lawn & bedding areas'),
    (p_id,'BOQ-07','Supply','Toro 570Z 6-inch Spray Head','Material','Nos',320,680,'false','Wide-area spray'),
    (p_id,'BOQ-08','Supply','Toro T5 Rotor Full-circle 360°','Material','Nos',160,1250,'false','Fairway rotors'),
    (p_id,'BOQ-09','Supply','Toro T7 Rotor Adjustable Arc','Material','Nos',220,1450,'false','Boundary rotors'),
    (p_id,'BOQ-10','Supply','Toro Dripline 16mm 0.6 L/hr','Material','Mtr',6500,85,'false','Flower beds & shrubs'),
    (p_id,'BOQ-11','Supply','Solenoid Valve 24VAC 1 inch','Material','Nos',80,2200,'false','Zone control solenoids'),
    (p_id,'BOQ-12','Supply','Ball Valve 1 inch SS','Material','Nos',80,650,'false','Zone isolation'),
    (p_id,'BOQ-13','Supply','Y-Strainer Filter 1 inch','Material','Nos',30,850,'false','At zone entry'),
    (p_id,'BOQ-14','Supply','Control Cable 7-core 18AWG','Material','Mtr',2800,48,'false','From controller to valves'),
    (p_id,'BOQ-15','Supply','Control Cable 2-core 18AWG','Material','Mtr',1500,28,'false','Sensor wiring'),
    (p_id,'BOQ-16','Supply','Misc Fittings (elbows, tees, reducers)','Material','Lot',1,185000,'false','Lump sum allowance'),
    (p_id,'BOQ-17','Supply','PVC Conduit 25mm','Material','Mtr',1200,32,'false','Cable duct across paths'),
    (p_id,'BOQ-18','Supply','Pump 1 HP SS Submersible','Material','Nos',3,28000,'false','Booster pumps'),
    (p_id,'BOQ-19','Supply','Rain/Freeze Sensor Wireless','Material','Nos',8,4500,'false','One per controller'),
    (p_id,'BOQ-20','Supply','Valve Box Small 10x10 inch','Material','Nos',80,320,'false','Underground enclosures'),
    -- Installation BOQ items (total ~ 7,11,000)
    (p_id,'BOQ-21','Installation','Mainline & Sub-main Trenching & Laying','Installation','Mtr',2700,60,'false','Incl. backfill & compaction'),
    (p_id,'BOQ-22','Installation','Lateral Pipe Laying & Connections','Installation','Mtr',4200,35,'false','Shallower trench'),
    (p_id,'BOQ-23','Installation','Sprinkler/Rotor Installation & Alignment','Installation','Nos',1180,95,'false','Head installation & setting'),
    (p_id,'BOQ-24','Installation','Controller Mounting & Programming','Installation','Nos',8,4500,'false','Per controller'),
    (p_id,'BOQ-25','Installation','Solenoid & Valve Installation','Installation','Nos',80,750,'false','3-wire connection'),
    (p_id,'BOQ-26','Installation','Cable Laying & Termination','Installation','Mtr',4300,28,'false','Pull through conduit'),
    (p_id,'BOQ-27','Installation','System Testing, Flushing & Commissioning','Installation','Lot',1,45000,'false','Includes pressure test')
  ON CONFLICT (project_id, boq_ref) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 5 — BOQ SAP BREAKUP
  -- ----------------------------------------------------------
  INSERT INTO public.boq_sap_breakup
    (project_id, parent_boq_ref, sap_boq_ref, material_code, description, uom, required_qty, rate)
  VALUES
    (p_id,'BOQ-01','SAP-01-A','TORO-IC-6','Toro IC 6-Station Controller','Nos',8,18500),
    (p_id,'BOQ-02','SAP-02-A','TORO-DRIPMT','Toro Drip Manifold Kit','Kit',25,4200),
    (p_id,'BOQ-03','SAP-03-A','PIPE-HDPE-32','HDPE Pipe 32mm PN-6','Mtr',4200,65),
    (p_id,'BOQ-04','SAP-04-A','PIPE-HDPE-63','HDPE Pipe 63mm PN-4','Mtr',1800,130),
    (p_id,'BOQ-05','SAP-05-A','PIPE-HDPE-90','HDPE Pipe 90mm PN-4','Mtr',900,220),
    (p_id,'BOQ-06','SAP-06-A','TORO-570Z-4','Toro 570Z 4-inch Spray Head','Nos',480,560),
    (p_id,'BOQ-07','SAP-07-A','TORO-570Z-6','Toro 570Z 6-inch Spray Head','Nos',320,680),
    (p_id,'BOQ-08','SAP-08-A','TORO-T5-360','Toro T5 Rotor 360°','Nos',160,1250),
    (p_id,'BOQ-09','SAP-09-A','TORO-T7-ADJ','Toro T7 Rotor Adj Arc','Nos',220,1450),
    (p_id,'BOQ-10','SAP-10-A','TORO-DL-DRIP','Toro Dripline 16mm','Mtr',6500,85),
    (p_id,'BOQ-11','SAP-11-A','SOLV-24V','Solenoid Valve 24VAC 1 inch','Nos',80,2200),
    (p_id,'BOQ-12','SAP-12-A','BVLV-1IN','Ball Valve 1 inch SS','Nos',80,650),
    (p_id,'BOQ-13','SAP-13-A','FILTER-Y-1IN','Y-Strainer Filter 1 inch','Nos',30,850),
    (p_id,'BOQ-14','SAP-14-A','WIRE-7C18','Control Cable 7-core 18AWG','Mtr',2800,48),
    (p_id,'BOQ-15','SAP-15-A','WIRE-2C18','Control Cable 2-core 18AWG','Mtr',1500,28),
    (p_id,'BOQ-16','SAP-16-A','FITTING-MISC','Misc Fittings','Lot',1,185000),
    (p_id,'BOQ-17','SAP-17-A','CONDUIT-25','PVC Conduit 25mm','Mtr',1200,32),
    (p_id,'BOQ-18','SAP-18-A','PUMP-1HP','Pump 1 HP SS Submersible','Nos',3,28000),
    (p_id,'BOQ-19','SAP-19-A','SENSOR-RAIN','Rain/Freeze Sensor Wireless','Nos',8,4500),
    (p_id,'BOQ-20','SAP-20-A','VALVEBOX-SM','Valve Box Small','Nos',80,320),
    (p_id,'BOQ-21','SAP-21-A',NULL,'Mainline Trenching & Laying','Mtr',2700,60),
    (p_id,'BOQ-22','SAP-22-A',NULL,'Lateral Pipe Laying','Mtr',4200,35),
    (p_id,'BOQ-23','SAP-23-A',NULL,'Sprinkler/Rotor Installation','Nos',1180,95),
    (p_id,'BOQ-24','SAP-24-A',NULL,'Controller Mounting & Programming','Nos',8,4500),
    (p_id,'BOQ-25','SAP-25-A',NULL,'Solenoid & Valve Installation','Nos',80,750),
    (p_id,'BOQ-26','SAP-26-A',NULL,'Cable Laying & Termination','Mtr',4300,28),
    (p_id,'BOQ-27','SAP-27-A',NULL,'Testing & Commissioning','Lot',1,45000)
  ON CONFLICT (project_id, sap_boq_ref) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 6 — WAREHOUSE PLANNING
  -- ----------------------------------------------------------
  INSERT INTO public.warehouse_planning
    (project_id, sap_boq_ref, material_code, warehouse_location, required_qty, available_warehouse_qty, reserved_qty)
  VALUES
    (p_id,'SAP-01-A','TORO-IC-6','WH-SITE',8,0,0),
    (p_id,'SAP-02-A','TORO-DRIPMT','WH-SITE',25,10,0),
    (p_id,'SAP-03-A','PIPE-HDPE-32','WH-SITE',4200,800,0),
    (p_id,'SAP-04-A','PIPE-HDPE-63','WH-SITE',1800,300,0),
    (p_id,'SAP-05-A','PIPE-HDPE-90','WH-SITE',900,100,0),
    (p_id,'SAP-06-A','TORO-570Z-4','WH-SITE',480,200,0),
    (p_id,'SAP-07-A','TORO-570Z-6','WH-SITE',320,140,0),
    (p_id,'SAP-08-A','TORO-T5-360','WH-SITE',160,60,0),
    (p_id,'SAP-09-A','TORO-T7-ADJ','WH-SITE',220,80,0),
    (p_id,'SAP-10-A','TORO-DL-DRIP','WH-SITE',6500,2000,0),
    (p_id,'SAP-11-A','SOLV-24V','WH-SITE',80,30,0),
    (p_id,'SAP-12-A','BVLV-1IN','WH-SITE',80,30,0),
    (p_id,'SAP-13-A','FILTER-Y-1IN','WH-SITE',30,10,0),
    (p_id,'SAP-14-A','WIRE-7C18','WH-SITE',2800,600,0),
    (p_id,'SAP-15-A','WIRE-2C18','WH-SITE',1500,400,0),
    (p_id,'SAP-16-A','FITTING-MISC','WH-SITE',1,0,0),
    (p_id,'SAP-17-A','CONDUIT-25','WH-SITE',1200,300,0),
    (p_id,'SAP-18-A','PUMP-1HP','WH-SITE',3,0,0),
    (p_id,'SAP-19-A','SENSOR-RAIN','WH-SITE',8,0,0),
    (p_id,'SAP-20-A','VALVEBOX-SM','WH-SITE',80,30,0);

  -- ----------------------------------------------------------
  -- STEP 7 — PURCHASE REQUESTS
  -- ----------------------------------------------------------
  INSERT INTO public.purchase_request
    (pr_no, pr_date, project_id, sap_boq_ref, material_code, pr_qty, uom, required_date, priority, justification, status)
  VALUES
    ('PR-2026-001','2026-01-20',p_id,'SAP-01-A','TORO-IC-6',8,'Nos','2026-02-10','High','Controllers required before zone layout','Approved'),
    ('PR-2026-002','2026-01-20',p_id,'SAP-03-A','PIPE-HDPE-32',4200,'Mtr','2026-02-15','High','Lateral pipe for all zones','Approved'),
    ('PR-2026-003','2026-01-20',p_id,'SAP-04-A','PIPE-HDPE-63',1800,'Mtr','2026-02-15','High','Sub-main network','Approved'),
    ('PR-2026-004','2026-01-20',p_id,'SAP-05-A','PIPE-HDPE-90',900,'Mtr','2026-02-15','High','Main supply line','Approved'),
    ('PR-2026-005','2026-01-22',p_id,'SAP-06-A','TORO-570Z-4',480,'Nos','2026-02-20','Medium','Spray heads for lawn areas','Approved'),
    ('PR-2026-006','2026-01-22',p_id,'SAP-07-A','TORO-570Z-6',320,'Nos','2026-02-20','Medium','Wide area spray heads','Approved'),
    ('PR-2026-007','2026-01-22',p_id,'SAP-08-A','TORO-T5-360',160,'Nos','2026-02-20','Medium','Fairway rotors','Approved'),
    ('PR-2026-008','2026-01-22',p_id,'SAP-09-A','TORO-T7-ADJ',220,'Nos','2026-02-20','Medium','Boundary rotors','Approved'),
    ('PR-2026-009','2026-01-25',p_id,'SAP-10-A','TORO-DL-DRIP',6500,'Mtr','2026-02-25','Medium','Drip for flower beds','Approved'),
    ('PR-2026-010','2026-01-25',p_id,'SAP-11-A','SOLV-24V',80,'Nos','2026-02-25','High','Zone control solenoids','Approved'),
    ('PR-2026-011','2026-01-25',p_id,'SAP-12-A','BVLV-1IN',80,'Nos','2026-02-15','High','Isolation valves','Approved'),
    ('PR-2026-012','2026-01-28',p_id,'SAP-14-A','WIRE-7C18',2800,'Mtr','2026-02-20','Medium','Controller wiring','Approved'),
    ('PR-2026-013','2026-01-28',p_id,'SAP-18-A','PUMP-1HP',3,'Nos','2026-03-01','High','Booster pumps for low-pressure zones','Approved'),
    ('PR-2026-014','2026-02-01',p_id,'SAP-19-A','SENSOR-RAIN',8,'Nos','2026-03-05','Low','Smart rain sensors','Draft')
  ON CONFLICT (pr_no) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 8 — PURCHASE ORDERS
  -- ----------------------------------------------------------
  INSERT INTO public.purchase_order
    (po_no, po_date, project_id, pr_ref, sap_boq_ref, material_code, vendor_code, po_qty, po_rate, tax_amount, freight_amount, expected_delivery, po_status, delivery_status)
  VALUES
    ('PO-2026-001','2026-01-25',p_id,'PR-2026-001','SAP-01-A','TORO-IC-6','VND-001',8,18500,26640,1500,'2026-02-10','Closed','Delivered'),
    ('PO-2026-002','2026-01-28',p_id,'PR-2026-002','SAP-03-A','PIPE-HDPE-32','VND-002',4200,62,23088,8000,'2026-02-18','Closed','Delivered'),
    ('PO-2026-003','2026-01-28',p_id,'PR-2026-003','SAP-04-A','PIPE-HDPE-63','VND-002',1800,125,27000,5000,'2026-02-18','Closed','Delivered'),
    ('PO-2026-004','2026-01-28',p_id,'PR-2026-004','SAP-05-A','PIPE-HDPE-90','VND-002',900,210,22680,4000,'2026-02-18','Closed','Delivered'),
    ('PO-2026-005','2026-02-01',p_id,'PR-2026-005','SAP-06-A','TORO-570Z-4','VND-001',480,545,47088,2000,'2026-02-20','Closed','Delivered'),
    ('PO-2026-006','2026-02-01',p_id,'PR-2026-006','SAP-07-A','TORO-570Z-6','VND-001',320,660,38016,2000,'2026-02-20','Closed','Delivered'),
    ('PO-2026-007','2026-02-01',p_id,'PR-2026-007','SAP-08-A','TORO-T5-360','VND-001',160,1210,29952,1500,'2026-02-25','Closed','Delivered'),
    ('PO-2026-008','2026-02-01',p_id,'PR-2026-008','SAP-09-A','TORO-T7-ADJ','VND-001',220,1400,42240,1500,'2026-02-25','Partial','Partial'),
    ('PO-2026-009','2026-02-05',p_id,'PR-2026-009','SAP-10-A','TORO-DL-DRIP','VND-001',6500,82,63648,3000,'2026-03-01','Closed','Delivered'),
    ('PO-2026-010','2026-02-05',p_id,'PR-2026-010','SAP-11-A','SOLV-24V','VND-001',80,2100,26880,1000,'2026-02-28','Closed','Delivered'),
    ('PO-2026-011','2026-02-05',p_id,'PR-2026-011','SAP-12-A','BVLV-1IN','VND-002',80,620,5952,500,'2026-02-20','Closed','Delivered'),
    ('PO-2026-012','2026-02-08',p_id,'PR-2026-012','SAP-14-A','WIRE-7C18','VND-003',2800,46,19488,1200,'2026-02-25','Closed','Delivered'),
    ('PO-2026-013','2026-02-10',p_id,'PR-2026-013','SAP-18-A','PUMP-1HP','VND-001',3,27000,14580,0,'2026-03-05','Open','Pending'),
    ('PO-2026-014','2026-02-01',p_id,NULL,'SAP-16-A','FITTING-MISC','VND-002',1,175000,31500,2500,'2026-02-28','Closed','Delivered')
  ON CONFLICT (po_no) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 9 — GRN REGISTER
  -- ----------------------------------------------------------
  INSERT INTO public.grn_register
    (grn_no, grn_date, project_id, po_ref, sap_boq_ref, material_code, received_qty, accepted_qty, inspection_status, receipt_location, unit_rate, transport_cost)
  VALUES
    ('GRN-2026-001','2026-02-10',p_id,'PO-2026-001','SAP-01-A','TORO-IC-6',8,8,'Accepted','WH-SITE',18500,1500),
    ('GRN-2026-002','2026-02-19',p_id,'PO-2026-002','SAP-03-A','PIPE-HDPE-32',4200,4150,'Accepted','WH-SITE',62,8000),
    ('GRN-2026-003','2026-02-19',p_id,'PO-2026-003','SAP-04-A','PIPE-HDPE-63',1800,1800,'Accepted','WH-SITE',125,5000),
    ('GRN-2026-004','2026-02-19',p_id,'PO-2026-004','SAP-05-A','PIPE-HDPE-90',900,900,'Accepted','WH-SITE',210,4000),
    ('GRN-2026-005','2026-02-21',p_id,'PO-2026-005','SAP-06-A','TORO-570Z-4',480,478,'Accepted','WH-SITE',545,2000),
    ('GRN-2026-006','2026-02-21',p_id,'PO-2026-006','SAP-07-A','TORO-570Z-6',320,320,'Accepted','WH-SITE',660,2000),
    ('GRN-2026-007','2026-02-26',p_id,'PO-2026-007','SAP-08-A','TORO-T5-360',160,160,'Accepted','WH-SITE',1210,1500),
    ('GRN-2026-008','2026-02-26',p_id,'PO-2026-008','SAP-09-A','TORO-T7-ADJ',150,150,'Accepted','WH-SITE',1400,750),
    ('GRN-2026-009','2026-03-02',p_id,'PO-2026-009','SAP-10-A','TORO-DL-DRIP',6500,6450,'Accepted','WH-SITE',82,3000),
    ('GRN-2026-010','2026-03-01',p_id,'PO-2026-010','SAP-11-A','SOLV-24V',80,80,'Accepted','WH-SITE',2100,1000),
    ('GRN-2026-011','2026-02-22',p_id,'PO-2026-011','SAP-12-A','BVLV-1IN',80,80,'Accepted','WH-SITE',620,500),
    ('GRN-2026-012','2026-02-26',p_id,'PO-2026-012','SAP-14-A','WIRE-7C18',2800,2800,'Accepted','WH-SITE',46,1200),
    ('GRN-2026-013','2026-03-01',p_id,'PO-2026-014','SAP-16-A','FITTING-MISC',1,1,'Accepted','WH-SITE',175000,2500)
  ON CONFLICT (grn_no) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 10 — WAREHOUSE STOCK
  -- ----------------------------------------------------------
  INSERT INTO public.warehouse_stock
    (project_id, material_code, location, current_qty, weighted_avg_cost)
  VALUES
    (p_id,'TORO-IC-6','WH-SITE',3,18500),
    (p_id,'PIPE-HDPE-32','WH-SITE',1850,62),
    (p_id,'PIPE-HDPE-63','WH-SITE',680,125),
    (p_id,'PIPE-HDPE-90','WH-SITE',380,210),
    (p_id,'TORO-570Z-4','WH-SITE',130,545),
    (p_id,'TORO-570Z-6','WH-SITE',90,660),
    (p_id,'TORO-T5-360','WH-SITE',40,1210),
    (p_id,'TORO-T7-ADJ','WH-SITE',50,1400),
    (p_id,'TORO-DL-DRIP','WH-SITE',2800,82),
    (p_id,'SOLV-24V','WH-SITE',20,2100),
    (p_id,'BVLV-1IN','WH-SITE',22,620),
    (p_id,'WIRE-7C18','WH-SITE',600,46),
    (p_id,'FITTING-MISC','WH-SITE',1,175000)
  ON CONFLICT (project_id, material_code, location) DO UPDATE
    SET current_qty = EXCLUDED.current_qty,
        weighted_avg_cost = EXCLUDED.weighted_avg_cost,
        last_updated = NOW();

  -- ----------------------------------------------------------
  -- STEP 11 — DC REGISTER
  -- ----------------------------------------------------------
  INSERT INTO public.dc_register
    (dc_no, dc_date, project_id, sap_boq_ref, material_code, dc_qty, from_location, to_site, dc_status)
  VALUES
    ('DC-2026-001','2026-02-15',p_id,'SAP-01-A','TORO-IC-6',5,'WH-SITE','Zone Control Room','Received'),
    ('DC-2026-002','2026-02-22',p_id,'SAP-03-A','PIPE-HDPE-32',2300,'WH-SITE','Site Zone A','Received'),
    ('DC-2026-003','2026-02-22',p_id,'SAP-04-A','PIPE-HDPE-63',1120,'WH-SITE','Site Zone A','Received'),
    ('DC-2026-004','2026-02-22',p_id,'SAP-05-A','PIPE-HDPE-90',520,'WH-SITE','Main Distribution Route','Received'),
    ('DC-2026-005','2026-02-25',p_id,'SAP-06-A','TORO-570Z-4',348,'WH-SITE','Zone A & B Lawn','Received'),
    ('DC-2026-006','2026-02-25',p_id,'SAP-07-A','TORO-570Z-6',230,'WH-SITE','Zone C & D Wide Area','Received'),
    ('DC-2026-007','2026-03-01',p_id,'SAP-08-A','TORO-T5-360',120,'WH-SITE','Fairway Zone E','Received'),
    ('DC-2026-008','2026-03-01',p_id,'SAP-09-A','TORO-T7-ADJ',100,'WH-SITE','Boundary Zone F','Received'),
    ('DC-2026-009','2026-03-05',p_id,'SAP-10-A','TORO-DL-DRIP',3650,'WH-SITE','Flower Bed Zone G','Received'),
    ('DC-2026-010','2026-03-05',p_id,'SAP-11-A','SOLV-24V',60,'WH-SITE','All Zones','Received'),
    ('DC-2026-011','2026-03-05',p_id,'SAP-12-A','BVLV-1IN',58,'WH-SITE','All Zones','Received'),
    ('DC-2026-012','2026-03-08',p_id,'SAP-14-A','WIRE-7C18',2200,'WH-SITE','Trenches All Zones','Received'),
    ('DC-2026-013','2026-03-08',p_id,'SAP-16-A','FITTING-MISC',1,'WH-SITE','All Zones','Received')
  ON CONFLICT (dc_no) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 12 — INSTALLATION EXECUTION
  -- ----------------------------------------------------------
  INSERT INTO public.installation_execution
    (execution_id, execution_date, project_id, boq_ref, sap_boq_ref, execution_type, executed_qty, rate, resource_type, supervisor, certified_by)
  VALUES
    ('EXEC-2026-001','2026-02-20',p_id,'BOQ-21','SAP-21-A','Mtr',1200,60,'Labor','Prakash Shinde','Site Engineer K. Desai'),
    ('EXEC-2026-002','2026-02-28',p_id,'BOQ-21','SAP-21-A','Mtr',900,60,'Labor','Prakash Shinde','Site Engineer K. Desai'),
    ('EXEC-2026-003','2026-03-05',p_id,'BOQ-21','SAP-21-A','Mtr',400,60,'Labor','Prakash Shinde','Site Engineer K. Desai'),
    ('EXEC-2026-004','2026-02-25',p_id,'BOQ-22','SAP-22-A','Mtr',2100,35,'Labor','Mohan Jadhav','Site Engineer K. Desai'),
    ('EXEC-2026-005','2026-03-05',p_id,'BOQ-22','SAP-22-A','Mtr',1400,35,'Labor','Mohan Jadhav','Site Engineer K. Desai'),
    ('EXEC-2026-006','2026-02-28',p_id,'BOQ-23','SAP-23-A','Nos',348,95,'Labor','Mohan Jadhav','Site Engineer K. Desai'),
    ('EXEC-2026-007','2026-03-10',p_id,'BOQ-23','SAP-23-A','Nos',220,95,'Labor','Mohan Jadhav','Site Engineer K. Desai'),
    ('EXEC-2026-008','2026-03-08',p_id,'BOQ-24','SAP-24-A','Nos',5,4500,'Labor','Prakash Shinde','Project Manager A. Kulkarni'),
    ('EXEC-2026-009','2026-03-10',p_id,'BOQ-25','SAP-25-A','Nos',60,750,'Labor','Mohan Jadhav','Site Engineer K. Desai'),
    ('EXEC-2026-010','2026-03-10',p_id,'BOQ-26','SAP-26-A','Mtr',2800,28,'Labor','Mohan Jadhav','Site Engineer K. Desai')
  ON CONFLICT (execution_id) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 13 — LABOR & EQUIPMENT COST
  -- ----------------------------------------------------------
  INSERT INTO public.labor_equipment_cost
    (entry_id, cost_date, project_id, sap_boq_ref, resource_type, resource_name, hours, quantity, rate, supervisor)
  VALUES
    ('LEC-2026-001','2026-02-17',p_id,'SAP-21-A','Labor','Excavation Gang (5 men)',80,NULL,350,'Prakash Shinde'),
    ('LEC-2026-002','2026-02-20',p_id,'SAP-21-A','Equipment','JCB Excavator 20T',16,NULL,2800,'Prakash Shinde'),
    ('LEC-2026-003','2026-02-22',p_id,'SAP-22-A','Labor','Plumbing Crew (4 men)',64,NULL,320,'Mohan Jadhav'),
    ('LEC-2026-004','2026-02-26',p_id,'SAP-23-A','Labor','Sprinkler Install Gang (3 men)',48,NULL,300,'Mohan Jadhav'),
    ('LEC-2026-005','2026-03-01',p_id,'SAP-22-A','Labor','Plumbing Crew (4 men)',72,NULL,320,'Mohan Jadhav'),
    ('LEC-2026-006','2026-03-05',p_id,'SAP-24-A','Labor','Electrical & Controls Team (2 men)',32,NULL,450,'Prakash Shinde'),
    ('LEC-2026-007','2026-03-06',p_id,'SAP-26-A','Labor','Cable Pull Team (3 men)',48,NULL,280,'Mohan Jadhav'),
    ('LEC-2026-008','2026-03-08',p_id,'SAP-25-A','Labor','Valve Installation Gang (2 men)',24,NULL,300,'Mohan Jadhav'),
    ('LEC-2026-009','2026-03-10',p_id,'SAP-23-A','Labor','Sprinkler Install Gang (3 men)',56,NULL,300,'Mohan Jadhav'),
    ('LEC-2026-010','2026-03-12',p_id,'SAP-27-A','Labor','Commissioning & QC Team (4 men)',32,NULL,500,'Prakash Shinde'),
    ('LEC-2026-011','2026-03-12',p_id,'SAP-27-A','Equipment','Water Tanker 5000 L',NULL,3,3500,'Prakash Shinde')
  ON CONFLICT (entry_id) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 14 — INVOICE REGISTER
  -- ----------------------------------------------------------
  INSERT INTO public.invoice_register
    (invoice_no, invoice_date, invoice_type, project_id, boq_ref, sap_boq_ref, dc_ref, billed_qty, rate, gst_amount, status, certified_date)
  VALUES
    ('INV-2026-001','2026-03-01','Material',p_id,'BOQ-01','SAP-01-A','DC-2026-001',5,18500,16650,'Paid','2026-03-05'),
    ('INV-2026-002','2026-03-01','Material',p_id,'BOQ-03','SAP-03-A','DC-2026-002',2300,65,26910,'Certified','2026-03-05'),
    ('INV-2026-003','2026-03-01','Material',p_id,'BOQ-04','SAP-04-A','DC-2026-003',1120,130,26208,'Certified','2026-03-05'),
    ('INV-2026-004','2026-03-01','Material',p_id,'BOQ-05','SAP-05-A','DC-2026-004',520,220,20592,'Certified','2026-03-05'),
    ('INV-2026-005','2026-03-10','Material',p_id,'BOQ-06','SAP-06-A','DC-2026-005',348,560,35078,'Submitted',NULL),
    ('INV-2026-006','2026-03-10','Material',p_id,'BOQ-07','SAP-07-A','DC-2026-006',230,680,28428,'Submitted',NULL),
    ('INV-2026-007','2026-03-10','Material',p_id,'BOQ-08','SAP-08-A','DC-2026-007',120,1250,27000,'Submitted',NULL),
    ('INV-2026-008','2026-03-15','Installation',p_id,'BOQ-21','SAP-21-A',NULL,2500,60,27000,'Certified','2026-03-18'),
    ('INV-2026-009','2026-03-15','Installation',p_id,'BOQ-22','SAP-22-A',NULL,3500,35,22050,'Certified','2026-03-18'),
    ('INV-2026-010','2026-03-15','Installation',p_id,'BOQ-23','SAP-23-A',NULL,568,95,19329,'Submitted',NULL)
  ON CONFLICT (invoice_no) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 15 — PAYMENT TRACKER
  -- ----------------------------------------------------------
  INSERT INTO public.payment_tracker
    (payment_id, invoice_ref, payment_date, payment_amount, payment_mode, transaction_ref, remarks)
  VALUES
    ('PAY-2026-001','INV-2026-001','2026-03-08',109150,'Bank Transfer','TXN-MH-20260308-001','1st milestone payment — Controllers'),
    ('PAY-2026-002','INV-2026-008','2026-03-20',177000,'Bank Transfer','TXN-MH-20260320-001','Installation progress — Mainline'),
    ('PAY-2026-003','INV-2026-009','2026-03-20',144550,'Bank Transfer','TXN-MH-20260320-002','Installation progress — Laterals'),
    ('PAY-2026-004','INV-2026-002','2026-03-12',100000,'Bank Transfer','TXN-MH-20260312-001','Partial payment for pipe supply lot'),
    ('PAY-2026-005','INV-2026-003','2026-03-12',85000,'Bank Transfer','TXN-MH-20260312-002','Partial payment for sub-main supply'),
    ('PAY-2026-006','INV-2026-010','2026-03-21',50000,'Cheque','CHQ-778811','Partial payment for controller wiring'),
    ('PAY-2026-007','INV-2026-005','2026-03-21',120000,'UPI','UPI-IRR-20260321-01','Advance against spray head certification')
  ON CONFLICT (payment_id) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 16 — BUDGET
  -- ----------------------------------------------------------
  INSERT INTO public.budget (project_id, cost_category, budget_value, remarks)
  VALUES
    (p_id,'Material',3867000,'Contract material value'),
    (p_id,'Installation',711000,'Contract installation value'),
    (p_id,'Labor',480000,'Internal labor estimate'),
    (p_id,'Equipment',95000,'Machinery & plant hire estimate'),
    (p_id,'Subcontract',231000,'Civil & plumbing subcontract'),
    (p_id,'Miscellaneous',85000,'Contingency & site expenses');

  -- ----------------------------------------------------------
  -- STEP 17 — ACTUAL COST
  -- ----------------------------------------------------------
  INSERT INTO public.actual_cost (project_id, cost_type, amount, reference_id, cost_date)
  VALUES
    (p_id,'Material',148000,'GRN-2026-001','2026-02-10'),
    (p_id,'Material',266100,'GRN-2026-002','2026-02-19'),
    (p_id,'Material',226800,'GRN-2026-003','2026-02-19'),
    (p_id,'Material',193800,'GRN-2026-004','2026-02-19'),
    (p_id,'Material',262410,'GRN-2026-005','2026-02-21'),
    (p_id,'Material',213400,'GRN-2026-006','2026-02-21'),
    (p_id,'Material',195200,'GRN-2026-007','2026-02-26'),
    (p_id,'Material',210750,'GRN-2026-008','2026-02-26'),
    (p_id,'Material',533400,'GRN-2026-009','2026-03-02'),
    (p_id,'Material',169000,'GRN-2026-010','2026-03-01'),
    (p_id,'Material',50160,'GRN-2026-011','2026-02-22'),
    (p_id,'Material',130480,'GRN-2026-012','2026-02-26'),
    (p_id,'Material',177500,'GRN-2026-013','2026-03-01'),
    (p_id,'Labor',28000,'LEC-2026-001','2026-02-17'),
    (p_id,'Equipment',44800,'LEC-2026-002','2026-02-20'),
    (p_id,'Labor',20480,'LEC-2026-003','2026-02-22'),
    (p_id,'Labor',14400,'LEC-2026-004','2026-02-26'),
    (p_id,'Labor',23040,'LEC-2026-005','2026-03-01'),
    (p_id,'Labor',14400,'LEC-2026-006','2026-03-05'),
    (p_id,'Labor',13440,'LEC-2026-007','2026-03-06'),
    (p_id,'Labor',7200,'LEC-2026-008','2026-03-08'),
    (p_id,'Labor',16800,'LEC-2026-009','2026-03-10'),
    (p_id,'Labor',16000,'LEC-2026-010','2026-03-12'),
    (p_id,'Equipment',10500,'LEC-2026-011','2026-03-12');

  -- ----------------------------------------------------------
  -- STEP 18 — SCHEDULE MILESTONES
  --  (trigger auto-sets delay_days & status)
  -- ----------------------------------------------------------
  INSERT INTO public.schedule_milestones
    (milestone_id, project_id, boq_ref, milestone_name, planned_start, planned_finish, actual_start, actual_finish, completion_percent)
  VALUES
    ('MS-2026-001',p_id,'BOQ-01','Mobilization & Site Setup','2026-01-15','2026-01-25','2026-01-16','2026-01-26',100),
    ('MS-2026-002',p_id,'BOQ-05','Mainline Pipe Trenching & Laying','2026-01-26','2026-02-20','2026-01-28','2026-02-28',100),
    ('MS-2026-003',p_id,'BOQ-03','Sub-main & Lateral Pipe Laying','2026-02-10','2026-03-05','2026-02-12',NULL,75),
    ('MS-2026-004',p_id,'BOQ-01','Controller Installation & Wiring','2026-02-20','2026-03-10','2026-02-22',NULL,60),
    ('MS-2026-005',p_id,'BOQ-21','Sprinkler & Rotor Installation','2026-02-25','2026-03-20','2026-02-27',NULL,48),
    ('MS-2026-006',p_id,'BOQ-10','Drip Irrigation Zones','2026-03-01','2026-03-25',NULL,NULL,0),
    ('MS-2026-007',p_id,'BOQ-27','System Testing & Commissioning','2026-03-20','2026-04-05',NULL,NULL,0),
    ('MS-2026-008',p_id,'BOQ-27','Final Handover & Snag Clearance','2026-04-05','2026-04-15',NULL,NULL,0)
  ON CONFLICT (milestone_id) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 19 — CHANGE ORDERS
  -- ----------------------------------------------------------
  INSERT INTO public.change_order
    (co_no, co_date, project_id, boq_ref, change_type, description, qty_change, rate_change, approval_status, remarks)
  VALUES
    ('CO-2026-001','2026-02-18',p_id,'BOQ-09','Revision',
     'Client requested additional 20 Toro T7 rotors for north boundary (revised layout)',
     20,1450,'Approved','Approved by Mr. Verma (Client PM) on 2026-02-20'),
    ('CO-2026-002','2026-03-05',p_id,'BOQ-10','Addition',
     'Additional drip runs for newly planted rose garden — Zone H',
     800,85,'Submitted','Pending client approval')
  ON CONFLICT (co_no) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 20 — DOCUMENT REGISTER
  -- ----------------------------------------------------------
  INSERT INTO public.document_register
    (doc_id, project_id, doc_type, doc_no, description, received_date, submitted_date, status)
  VALUES
    ('DOC-2026-001',p_id,'Drawing','DWG-IRR-001','Irrigation Layout Plan — Zone A & B Overall','2026-01-15',NULL,'Active'),
    ('DOC-2026-002',p_id,'Drawing','DWG-IRR-002','Mainline & Sub-main Routing Diagram','2026-01-15',NULL,'Active'),
    ('DOC-2026-003',p_id,'Drawing','DWG-IRR-003','Controller Wiring Schematic — All Zones','2026-01-18',NULL,'Active'),
    ('DOC-2026-004',p_id,'Approval','APP-001','Toro System Design Approval from Toro India','2026-01-20','2026-01-22','Active'),
    ('DOC-2026-005',p_id,'Certificate','CERT-001','Material Quality Certificate — HDPE Pipes','2026-02-19',NULL,'Active'),
    ('DOC-2026-006',p_id,'Certificate','CERT-002','Material Test Certificate — Toro Controllers','2026-02-10',NULL,'Active'),
    ('DOC-2026-007',p_id,'Report','RPT-001','Weekly Progress Report — Week 7 (Feb 16-20)','2026-02-21','2026-02-22','Active'),
    ('DOC-2026-008',p_id,'Report','RPT-002','Weekly Progress Report — Week 8 (Feb 23-27)','2026-02-28','2026-03-01','Active'),
    ('DOC-2026-009',p_id,'Report','RPT-003','Weekly Progress Report — Week 9 (Mar 2-6)','2026-03-07','2026-03-08','Active'),
    ('DOC-2026-010',p_id,'Report','RPT-004','Weekly Progress Report — Week 10 (Mar 9-13)','2026-03-14','2026-03-15','Active'),
    ('DOC-2026-011',p_id,'Invoice','INV-DOC-001','Invoice INV-2026-001 — Controllers Supply','2026-03-01',NULL,'Active'),
    ('DOC-2026-012',p_id,'Other','SAF-001','Site Safety Plan & PPE Register','2026-01-16',NULL,'Active'),
    ('DOC-2026-013',p_id,'Photo','PHO-001','Progress Photo Set — Zone A Trenching','2026-02-28',NULL,'Active'),
    ('DOC-2026-014',p_id,'Report','RPT-005','Commissioning Checklist Draft','2026-03-18','2026-03-18','Active'),
    ('DOC-2026-015',p_id,'Certificate','CERT-003','Pump Test Certificate — 1 HP Booster Set','2026-03-20',NULL,'Active')
  ON CONFLICT (doc_id) DO NOTHING;

  -- ----------------------------------------------------------
  -- STEP 21 — ALERT LOG
  -- ----------------------------------------------------------
  INSERT INTO public.alert_log
    (project_id, category, severity, message, sap_boq_ref, resolved, resolved_date)
  VALUES
    (p_id,'Procurement','Medium','GRN-2026-002: 50 mtr of HDPE 32mm rejected — short length coils. Replacement required.','SAP-03-A',false,NULL),
    (p_id,'Schedule','High','BOQ-02 — Mainline Trenching: 8-day delay vs planned (weather & rocky terrain). Monitor daily.','SAP-21-A',false,NULL),
    (p_id,'Finance','Medium','PO-2026-013 (Pumps) delivery still pending. Required by commissioning date 2026-03-20.','SAP-18-A',false,NULL),
    (p_id,'Billing','High','INV-2026-005, INV-2026-006, INV-2026-007 submitted but not yet certified by client. Chase for approval.','SAP-06-A',false,NULL),
    (p_id,'Procurement','Low','PR-2026-014 (Rain Sensors) still in Draft. Raise PO before commissioning.','SAP-19-A',false,NULL),
    (p_id,'Execution','Medium','BOQ-24: Only 5 of 8 controllers mounted. Remaining 3 pending due to civil wall delay.','SAP-24-A',false,NULL),
    (p_id,'Schedule','Low','Drip Zone (BOQ-10) not yet started. Planned start 2026-03-01. Currently delayed.','SAP-10-A',false,NULL)
  ;

END $$;

-- ============================================================
-- VERIFICATION SUMMARY (informational — no DML)
-- ============================================================
SELECT 'Project' AS entity, COUNT(*) AS records FROM public.projects WHERE project_id = 'PRJ-2026-001'
UNION ALL SELECT 'BOQ Contract Items', COUNT(*) FROM public.boq_contract bc JOIN public.projects p ON bc.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'SAP Breakup Items', COUNT(*) FROM public.boq_sap_breakup bs JOIN public.projects p ON bs.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'Purchase Requests', COUNT(*) FROM public.purchase_request pr JOIN public.projects p ON pr.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'Purchase Orders', COUNT(*) FROM public.purchase_order po JOIN public.projects p ON po.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'GRN Records', COUNT(*) FROM public.grn_register g JOIN public.projects p ON g.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'DC Records', COUNT(*) FROM public.dc_register d JOIN public.projects p ON d.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'Installation Entries', COUNT(*) FROM public.installation_execution ie JOIN public.projects p ON ie.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'Labor/Equipment Entries', COUNT(*) FROM public.labor_equipment_cost lec JOIN public.projects p ON lec.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'Invoices', COUNT(*) FROM public.invoice_register iv JOIN public.projects p ON iv.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'Payments', COUNT(*) FROM public.payment_tracker pt JOIN public.invoice_register iv ON pt.invoice_ref = iv.invoice_no JOIN public.projects p ON iv.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'Milestones', COUNT(*) FROM public.schedule_milestones sm JOIN public.projects p ON sm.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'Alerts', COUNT(*) FROM public.alert_log al JOIN public.projects p ON al.project_id = p.id WHERE p.project_id = 'PRJ-2026-001'
UNION ALL SELECT 'Documents', COUNT(*) FROM public.document_register dr JOIN public.projects p ON dr.project_id = p.id WHERE p.project_id = 'PRJ-2026-001';
