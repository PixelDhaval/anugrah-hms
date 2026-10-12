-- Create ipd_appointment_particulars table
CREATE TABLE IF NOT EXISTS ipd_appointment_particulars (
    id SERIAL PRIMARY KEY,
    ipd_appointment_id INTEGER NOT NULL REFERENCES ipd_appointments(id) ON DELETE CASCADE,
    indoor_service_id INTEGER NOT NULL REFERENCES indoor_services(id),
    rate DECIMAL(10,2) NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 