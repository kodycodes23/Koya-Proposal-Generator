-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'sent', 'send_failed')),

  client_name text not null,
  client_email text not null,
  company_name text not null,
  date_of_call date,
  salesperson_name text not null,
  client_needs_summary text,
  project_scope text,
  goals_and_objectives text,
  recommended_services text,
  proposed_timeline text,
  estimated_pricing text,

  supporting_material text,
  missing_fields jsonb not null default '[]',

  approved_by text,
  approved_at timestamptz,

  pdf_path text,
  pdf_url text,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists proposal_sections (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  section_key text not null
    check (section_key in ('introduction', 'proposed_solution', 'deliverables', 'timeline', 'pricing', 'next_steps')),
  content text not null default '',
  -- Structured data for the deliverables/timeline/pricing sections (null for
  -- prose sections, and null for any row created before this column existed -
  -- both the editor and the live preview fall back to rendering `content` as
  -- prose when this is null).
  structured jsonb,
  source text not null default 'ai' check (source in ('ai', 'human')),
  version int not null default 1,
  updated_at timestamptz not null default now(),
  unique (proposal_id, section_key)
);

create table if not exists proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  event_type text not null,
  status text not null default 'success' check (status in ('success', 'failure')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists proposal_events_proposal_id_idx on proposal_events(proposal_id, created_at desc);
create index if not exists proposal_sections_proposal_id_idx on proposal_sections(proposal_id);

-- All access goes through server-side route handlers using the service-role
-- key, which bypasses RLS. RLS is enabled with no policies as defense in
-- depth in case the anon key is ever used client-side.
alter table proposals enable row level security;
alter table proposal_sections enable row level security;
alter table proposal_events enable row level security;

-- Storage bucket for generated proposal PDFs (private; accessed via signed URLs).
insert into storage.buckets (id, name, public)
values ('proposal-pdfs', 'proposal-pdfs', false)
on conflict (id) do nothing;

-- This project's `service_role` didn't have the default table grants Supabase
-- normally sets up, which causes "permission denied for table X" even though
-- service_role bypasses RLS (RLS bypass and table-level GRANTs are separate
-- layers). Grant explicitly, and make it apply to future tables too.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Added after the initial launch: structured pricing/timeline/deliverables
-- data. Run this directly if your `proposal_sections` table already exists.
alter table proposal_sections add column if not exists structured jsonb;
