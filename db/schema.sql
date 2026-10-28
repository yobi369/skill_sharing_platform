CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL CHECK (length(trim(name)) >= 2),
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(120) NOT NULL CHECK (length(trim(title)) >= 3),
  description varchar(4000) NOT NULL CHECK (length(trim(description)) >= 10),
  category varchar(80) NOT NULL CHECK (length(trim(category)) >= 2),
  status varchar(16) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skills_public_search_idx ON skills (status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS skills_owner_updated_idx ON skills (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS skill_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message varchar(2000) NOT NULL CHECK (length(trim(message)) >= 10),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> provider_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_request_per_skill_and_requester
  ON skill_requests (skill_id, requester_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS requests_requester_created_idx ON skill_requests (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS requests_provider_created_idx ON skill_requests (provider_id, created_at DESC);


-- Additive product tables: safe to apply to existing installations.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(16) NOT NULL DEFAULT 'member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;


CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verification_user_idx ON email_verification_tokens (user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens (user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(40) NOT NULL,
  title varchar(160) NOT NULL,
  body varchar(1000) NOT NULL,
  href varchar(300),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type varchar(16) NOT NULL CHECK (target_type IN ('skill', 'user')),
  target_id uuid NOT NULL,
  reason varchar(40) NOT NULL CHECK (reason IN ('spam', 'harassment', 'fraud', 'unsafe', 'misleading', 'other')),
  details varchar(2000) NOT NULL CHECK (length(trim(details)) >= 10),
  status varchar(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  moderator_id uuid REFERENCES users(id) ON DELETE SET NULL,
  moderator_note varchar(2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports (target_type, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_report_per_reporter_target ON reports (reporter_id, target_type, target_id) WHERE status IN ('open', 'reviewing');
