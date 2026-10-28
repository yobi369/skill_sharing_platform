CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
