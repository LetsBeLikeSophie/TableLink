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
