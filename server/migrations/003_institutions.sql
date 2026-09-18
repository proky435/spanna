CREATE TABLE institutions (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CHECK (slug = LOWER(slug)),
  CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TRIGGER institutions_set_updated_at
BEFORE UPDATE ON institutions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE institution_memberships (
  id BIGSERIAL PRIMARY KEY,
  institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'teacher', 'student')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, user_id)
);

CREATE INDEX institution_memberships_user_idx ON institution_memberships(user_id, status);
CREATE INDEX institution_memberships_institution_idx ON institution_memberships(institution_id, role, status);

CREATE TRIGGER institution_memberships_set_updated_at
BEFORE UPDATE ON institution_memberships
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE classes (
  id BIGSERIAL PRIMARY KEY,
  institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  subject VARCHAR(180) NOT NULL DEFAULT '',
  term VARCHAR(120) NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX classes_institution_idx ON classes(institution_id) WHERE archived_at IS NULL;

CREATE TRIGGER classes_set_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE class_memberships (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id, user_id)
);

CREATE INDEX class_memberships_user_idx ON class_memberships(user_id);

CREATE TABLE invitations (
  id BIGSERIAL PRIMARY KEY,
  institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  class_id BIGINT REFERENCES classes(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('link', 'email', 'code')),
  email VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  token_hash VARCHAR(64),
  code_hash VARCHAR(64),
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0 AND max_uses <= 10000),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CHECK (token_hash IS NOT NULL OR code_hash IS NOT NULL),
  CHECK ((kind = 'email' AND email IS NOT NULL) OR kind <> 'email')
);

CREATE UNIQUE INDEX invitations_token_hash_idx ON invitations(token_hash) WHERE token_hash IS NOT NULL;
CREATE UNIQUE INDEX invitations_code_hash_idx ON invitations(code_hash) WHERE code_hash IS NOT NULL;
CREATE INDEX invitations_institution_idx ON invitations(institution_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  institution_id BIGINT REFERENCES institutions(id) ON DELETE SET NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_institution_idx ON audit_logs(institution_id, created_at DESC);

CREATE INDEX question_banks_institution_idx ON question_banks(institution_id) WHERE archived_at IS NULL;

ALTER TABLE question_banks
  ADD CONSTRAINT question_banks_institution_fk
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE;

ALTER TABLE question_banks
  DROP CONSTRAINT IF EXISTS question_banks_visibility_check;

ALTER TABLE question_banks
  ADD CONSTRAINT question_banks_visibility_check
  CHECK (visibility IN ('private', 'shared', 'institution', 'class', 'public'));

ALTER TABLE question_banks
  ADD CONSTRAINT question_banks_owner_scope_check
  CHECK (
    (owner_type = 'personal' AND institution_id IS NULL) OR
    (owner_type = 'institution' AND institution_id IS NOT NULL)
  );

CREATE TABLE question_bank_class_access (
  id BIGSERIAL PRIMARY KEY,
  question_bank_id BIGINT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  permission VARCHAR(16) NOT NULL CHECK (permission IN ('view', 'use', 'edit', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_bank_id, class_id)
);

CREATE INDEX question_bank_class_access_class_idx ON question_bank_class_access(class_id);
