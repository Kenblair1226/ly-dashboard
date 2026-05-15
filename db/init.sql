-- Schema for LY Dashboard PoC
-- Idempotent: every table uses upserts keyed by natural id.

CREATE TABLE IF NOT EXISTS legislators (
    id SERIAL PRIMARY KEY,
    term INT NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    party TEXT,
    caucus TEXT,
    constituency TEXT,
    gender TEXT,
    photo_url TEXT,
    onboard_date TEXT,
    education JSONB,
    experience JSONB,
    committees JSONB,
    contact JSONB,
    raw JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (term, name)
);

CREATE TABLE IF NOT EXISTS meets (
    id SERIAL PRIMARY KEY,
    legislator_term INT NOT NULL,
    legislator_name TEXT NOT NULL,
    meet_code TEXT NOT NULL,
    meet_type TEXT,
    session_period INT,
    session_times INT,
    title TEXT,
    dates JSONB,
    first_date DATE,
    raw JSONB,
    UNIQUE (legislator_term, legislator_name, meet_code)
);

CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    legislator_term INT NOT NULL,
    legislator_name TEXT NOT NULL,
    role TEXT NOT NULL,            -- propose | cosign
    bill_no TEXT NOT NULL,
    name TEXT,
    status TEXT,
    bill_type TEXT,
    proposal_source TEXT,
    session_period INT,
    proposers JSONB,
    cosigners JSONB,
    last_progress_date DATE,
    url TEXT,
    raw JSONB,
    UNIQUE (legislator_term, legislator_name, role, bill_no)
);

CREATE TABLE IF NOT EXISTS interpellations (
    id SERIAL PRIMARY KEY,
    legislator_term INT NOT NULL,
    legislator_name TEXT NOT NULL,
    interp_id TEXT NOT NULL,
    title TEXT,
    meet_code TEXT,
    session_period INT,
    date DATE,
    raw JSONB,
    UNIQUE (legislator_term, legislator_name, interp_id)
);

CREATE TABLE IF NOT EXISTS ivods (
    id SERIAL PRIMARY KEY,
    legislator_term INT NOT NULL,
    legislator_name TEXT NOT NULL,
    ivod_id BIGINT NOT NULL,
    ivod_url TEXT,
    video_url TEXT,
    date DATE,
    duration INT,
    meet_code TEXT,
    meet_name TEXT,
    speech_time TEXT,
    raw JSONB,
    UNIQUE (legislator_term, legislator_name, ivod_id)
);

CREATE TABLE IF NOT EXISTS news (
    id SERIAL PRIMARY KEY,
    legislator_name TEXT NOT NULL,
    guid TEXT NOT NULL,
    title TEXT,
    link TEXT,
    source TEXT,
    pub_date TIMESTAMPTZ,
    UNIQUE (legislator_name, guid)
);

CREATE INDEX IF NOT EXISTS idx_meets_first_date ON meets(first_date);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_ivods_date ON ivods(date);
CREATE INDEX IF NOT EXISTS idx_news_pub_date ON news(pub_date);

CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    term INT NOT NULL,
    session_period INT,
    session_times INT,
    meeting_name TEXT,
    vote_date DATE,
    vote_time TEXT,
    vote_type TEXT,
    vote_issue TEXT,
    presence INT,
    agree INT,
    against INT,
    abstain INT,
    supporters JSONB,
    opposers JSONB,
    abstainers JSONB,
    raw JSONB,
    UNIQUE (term, session_period, session_times, vote_date, vote_time, vote_issue)
);

CREATE TABLE IF NOT EXISTS vote_records (
    id SERIAL PRIMARY KEY,
    vote_id INT NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
    legislator_name TEXT NOT NULL,
    legislator_no TEXT,
    choice TEXT NOT NULL,        -- agree | against | abstain
    UNIQUE (vote_id, legislator_name)
);

CREATE INDEX IF NOT EXISTS idx_votes_date ON votes(vote_date);
CREATE INDEX IF NOT EXISTS idx_vote_records_name ON vote_records(legislator_name);
