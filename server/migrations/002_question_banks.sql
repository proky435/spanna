CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE question_banks (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_type VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (owner_type IN ('personal', 'institution')),
  institution_id BIGINT,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility VARCHAR(20) NOT NULL DEFAULT 'private' CONSTRAINT question_banks_visibility_check CHECK (visibility IN ('private', 'shared', 'public')),
  status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'pending_review', 'published', 'rejected', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CHECK ((owner_type = 'personal' AND institution_id IS NULL) OR owner_type = 'institution')
);

CREATE INDEX question_banks_owner_idx ON question_banks(owner_user_id) WHERE archived_at IS NULL;
CREATE INDEX question_banks_public_idx ON question_banks(status, visibility) WHERE archived_at IS NULL;

CREATE TRIGGER question_banks_set_updated_at
BEFORE UPDATE ON question_banks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE questions (
  id BIGSERIAL PRIMARY KEY,
  question_bank_id BIGINT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  external_id VARCHAR(160),
  type VARCHAR(24) NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'short_text', 'long_text')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB,
  grading_config JSONB NOT NULL DEFAULT '{}',
  explanation TEXT NOT NULL DEFAULT '',
  subject VARCHAR(160) NOT NULL DEFAULT '',
  topic VARCHAR(160) NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  difficulty VARCHAR(20) CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
  default_points NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (default_points >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  UNIQUE(question_bank_id, external_id),
  CHECK (jsonb_typeof(tags) = 'array'),
  CHECK (options IS NULL OR jsonb_typeof(options) = 'array')
);

CREATE INDEX questions_bank_idx ON questions(question_bank_id) WHERE archived_at IS NULL;
CREATE INDEX questions_subject_topic_idx ON questions(question_bank_id, subject, topic) WHERE archived_at IS NULL;

CREATE TRIGGER questions_set_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION touch_question_bank()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE question_banks SET updated_at = NOW() WHERE id = OLD.question_bank_id;
    RETURN OLD;
  END IF;
  UPDATE question_banks SET updated_at = NOW() WHERE id = NEW.question_bank_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questions_touch_bank
AFTER INSERT OR UPDATE OR DELETE ON questions
FOR EACH ROW EXECUTE FUNCTION touch_question_bank();

CREATE TABLE question_versions (
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_id, version)
);

CREATE TABLE question_bank_access (
  id BIGSERIAL PRIMARY KEY,
  question_bank_id BIGINT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(16) NOT NULL CHECK (permission IN ('view', 'use', 'edit', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_bank_id, user_id)
);

CREATE TABLE question_imports (
  id BIGSERIAL PRIMARY KEY,
  question_bank_id BIGINT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(16) NOT NULL CHECK (file_type IN ('json', 'csv', 'xlsx')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('preview', 'completed', 'failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE question_import_errors (
  id BIGSERIAL PRIMARY KEY,
  import_id BIGINT NOT NULL REFERENCES question_imports(id) ON DELETE CASCADE,
  row_number INTEGER,
  field VARCHAR(120),
  error_code VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  source_data JSONB
);
