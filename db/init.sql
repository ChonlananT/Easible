-- ตรวจสอบและสร้าง role admin หากยังไม่มี
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_roles
    WHERE rolname = 'admin'
  ) THEN
    CREATE USER admin WITH PASSWORD 'P@ssw0rd';
  END IF;
END$$;

-- สร้างฐานข้อมูล inventory และตั้งค่า privileges
CREATE DATABASE inventory;
\connect inventory
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('router', 'switch')),
    hostname VARCHAR(100) NOT NULL,
    ipaddress INET NOT NULL,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(50) NOT NULL,
    enable_password VARCHAR(50),
    "group" VARCHAR(255) DEFAULT NULL
);
GRANT ALL PRIVILEGES ON DATABASE inventory TO admin;
GRANT SELECT, INSERT, DELETE ON TABLE inventory TO admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO admin;

CREATE TABLE IF NOT EXISTS host_groups (
    id SERIAL PRIMARY KEY,
    host_id INT NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    FOREIGN KEY (host_id) REFERENCES inventory (id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE host_groups TO admin;
GRANT USAGE, SELECT ON SEQUENCE host_groups_id_seq TO admin;

-- สร้างฐานข้อมูล custom_lab และตั้งค่า privileges
CREATE DATABASE custom_lab;
\connect custom_lab
CREATE TABLE custom_labs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE lab_commands (
    id SERIAL PRIMARY KEY,
    custom_lab_id INTEGER REFERENCES custom_labs(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    host_expected_outputs TEXT[],
    hostnames TEXT[],
    command_order INTEGER,
    device_type VARCHAR(50) CHECK (device_type IN ('all', 'router', 'switch'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE custom_labs TO admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE lab_commands TO admin;
GRANT USAGE, SELECT ON SEQUENCE custom_labs_id_seq TO admin;
GRANT USAGE, SELECT ON SEQUENCE lab_commands_id_seq TO admin;
