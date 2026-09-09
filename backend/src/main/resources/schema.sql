-- STATE tables

CREATE TABLE IF NOT EXISTS customer (
    customer_id BIGINT PRIMARY KEY,
    name VARCHAR(50),
    phone VARCHAR(20),
    joined_at DATE
);

CREATE TABLE IF NOT EXISTS dealer (
    dealer_id BIGINT PRIMARY KEY,
    name VARCHAR(50),
    region VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS vehicle (
    vehicle_id BIGINT PRIMARY KEY,
    vin VARCHAR(30) UNIQUE,
    model VARCHAR(50),
    model_year INT,
    current_owner_id BIGINT REFERENCES customer(customer_id)
);

-- HISTORY tables (range-type)

CREATE TABLE IF NOT EXISTS ownership_history (
    id BIGINT PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicle(vehicle_id),
    owner_id BIGINT REFERENCES customer(customer_id),
    start_date DATE,
    end_date DATE
);

-- HISTORY tables (point-type)

CREATE TABLE IF NOT EXISTS service_history (
    id BIGINT PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicle(vehicle_id),
    dealer_id BIGINT REFERENCES dealer(dealer_id),
    service_date DATE,
    description VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS warranty_claim_history (
    id BIGINT PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicle(vehicle_id),
    claim_date DATE,
    claim_type VARCHAR(50),
    amount DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS price_history (
    id BIGINT PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicle(vehicle_id),
    recorded_at DATE,
    price DECIMAL(12,2)
);

-- Table metadata registry (see project-spec.md section 2)
-- type/historySubType/primaryKey/dateColumn/endDateColumn/foreignKeys are derived
-- live from information_schema (see SchemaIntrospectionRepository) rather than
-- stored here; table_meta only persists the user-curated filterableColumns whitelist.

CREATE TABLE IF NOT EXISTS table_meta (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS table_meta_filterable_column (
    table_meta_id BIGINT REFERENCES table_meta(id),
    filter_column VARCHAR(100),
    value_type VARCHAR(20)
);

-- Indexes for aggregate EXISTS filters (see project-spec.md section 7)
CREATE INDEX IF NOT EXISTS idx_service_history_vehicle_date ON service_history(vehicle_id, service_date);
CREATE INDEX IF NOT EXISTS idx_warranty_claim_history_vehicle_date ON warranty_claim_history(vehicle_id, claim_date);
CREATE INDEX IF NOT EXISTS idx_price_history_vehicle_date ON price_history(vehicle_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_ownership_history_vehicle ON ownership_history(vehicle_id);

-- Row-Level Security: per-country data isolation (see README "설계 아이디어: 유저·국가별
-- 데이터 격리"). Every table the app can be asked to read directly (not just the ones
-- reachable through the join engine) carries country + RLS, because /tables/{name}/preview
-- and /tables/{name}/columns/{col}/domain query a table by name without going through any
-- join chain at all.

ALTER TABLE customer ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'KR';
ALTER TABLE dealer ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'KR';
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'KR';
ALTER TABLE ownership_history ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'KR';
ALTER TABLE service_history ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'KR';
ALTER TABLE warranty_claim_history ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'KR';
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'KR';

-- One block per table instead of a DO $$ ... $$ loop: Spring's script runner
-- splits schema.sql on plain ';' and doesn't understand Postgres dollar-quoting,
-- so a DO block here fails at startup with "unterminated dollar quote" even
-- though it runs fine via psql directly.

ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_select_by_country ON customer;
CREATE POLICY customer_select_by_country ON customer FOR SELECT USING (country = current_setting('app.current_country', true) OR current_setting('app.current_country', true) = 'ALL');
DROP POLICY IF EXISTS customer_seed_insert ON customer;
CREATE POLICY customer_seed_insert ON customer FOR INSERT WITH CHECK (true);

ALTER TABLE dealer ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dealer_select_by_country ON dealer;
CREATE POLICY dealer_select_by_country ON dealer FOR SELECT USING (country = current_setting('app.current_country', true) OR current_setting('app.current_country', true) = 'ALL');
DROP POLICY IF EXISTS dealer_seed_insert ON dealer;
CREATE POLICY dealer_seed_insert ON dealer FOR INSERT WITH CHECK (true);

ALTER TABLE vehicle ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vehicle_select_by_country ON vehicle;
CREATE POLICY vehicle_select_by_country ON vehicle FOR SELECT USING (country = current_setting('app.current_country', true) OR current_setting('app.current_country', true) = 'ALL');
DROP POLICY IF EXISTS vehicle_seed_insert ON vehicle;
CREATE POLICY vehicle_seed_insert ON vehicle FOR INSERT WITH CHECK (true);

ALTER TABLE ownership_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ownership_history_select_by_country ON ownership_history;
CREATE POLICY ownership_history_select_by_country ON ownership_history FOR SELECT USING (country = current_setting('app.current_country', true) OR current_setting('app.current_country', true) = 'ALL');
DROP POLICY IF EXISTS ownership_history_seed_insert ON ownership_history;
CREATE POLICY ownership_history_seed_insert ON ownership_history FOR INSERT WITH CHECK (true);

ALTER TABLE service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_history_select_by_country ON service_history;
CREATE POLICY service_history_select_by_country ON service_history FOR SELECT USING (country = current_setting('app.current_country', true) OR current_setting('app.current_country', true) = 'ALL');
DROP POLICY IF EXISTS service_history_seed_insert ON service_history;
CREATE POLICY service_history_seed_insert ON service_history FOR INSERT WITH CHECK (true);

ALTER TABLE warranty_claim_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_claim_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS warranty_claim_history_select_by_country ON warranty_claim_history;
CREATE POLICY warranty_claim_history_select_by_country ON warranty_claim_history FOR SELECT USING (country = current_setting('app.current_country', true) OR current_setting('app.current_country', true) = 'ALL');
DROP POLICY IF EXISTS warranty_claim_history_seed_insert ON warranty_claim_history;
CREATE POLICY warranty_claim_history_seed_insert ON warranty_claim_history FOR INSERT WITH CHECK (true);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS price_history_select_by_country ON price_history;
CREATE POLICY price_history_select_by_country ON price_history FOR SELECT USING (country = current_setting('app.current_country', true) OR current_setting('app.current_country', true) = 'ALL');
DROP POLICY IF EXISTS price_history_seed_insert ON price_history;
CREATE POLICY price_history_seed_insert ON price_history FOR INSERT WITH CHECK (true);
