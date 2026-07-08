-- Tabela de usuários do CRM (auth local com JWT + bcrypt)
CREATE TABLE IF NOT EXISTS crm_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'representante')),
    representante TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas service_role acessa (nenhuma policy pública)
ALTER TABLE crm_users ENABLE ROW LEVEL SECURITY;

-- Inserir admin padrão (hash bcrypt de 'admin123!' com custo 10)
-- Se o admin já existir, não faz nada
INSERT INTO crm_users (username, password_hash, role, representante)
VALUES (
    'admin',
    '$2b$10$j53RdlQs54vqiAPdRPMUBOHMW65mxCI2didn5RnkxE2E/EZ1ASEPy',
    'admin',
    null
)
ON CONFLICT (username) DO NOTHING;
