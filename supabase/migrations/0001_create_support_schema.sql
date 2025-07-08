-- 0001_create_support_schema.sql
-- Initial schema for Shift-Bot support system
-- Run via: supabase db reset | supabase db push

-- ============================================================================
-- Extensions & Schema
-- ============================================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================================
-- ENUM types
-- ============================================================================
-- Source platform where the ticket originated
create type public.platform as enum ('telegram', 'slack');

-- Lifecycle state of a ticket
create type public.ticket_status as enum (
  'open',              -- freshly created, awaiting classification
  'auto_answered',     -- LLM replied; awaiting user feedback
  'awaiting_feedback', -- user may respond to bot or engineer
  'escalation_pending',-- awaiting on-call engineer to pick up
  'escalated',         -- engineer acknowledged
  'closed'             -- solved & confirmed
);

-- Action record categories for the ticket_actions journal
create type public.action_type as enum (
  'user_message',  -- message from end-user
  'llm_answer',    -- Gemini / other LLM reply
  'escalation_call',
  'engineer_note', -- manual comment from on-call engineer
  'system_event'   -- status change, retries, etc.
);

-- How an escalation was attempted
create type public.escalation_method as enum ('telegram_voice', 'phone_call');

-- ============================================================================
-- Helper function to manage updated_at columns
-- ============================================================================
create or replace function public.fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- ENGINEERS
-- ============================================================================
create table public.engineers (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id) on delete set null,
  name          text not null,
  email         text not null unique,
  telegram_id   text unique,
  slack_id      text unique,
  phone_number  text,
  is_on_call    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_engineers_updated
  before update on public.engineers
  for each row execute procedure public.fn_set_updated_at();

-- ============================================================================
-- TICKETS
-- ============================================================================
create table public.tickets (
  id                 uuid primary key default gen_random_uuid(),
  platform           public.platform not null,
  received_at        timestamptz not null default now(),
  user_external_id   text not null,            -- Slack user id / Telegram user id
  thread_id          text,                     -- Slack thread_ts / Telegram reply_to_message_id
  status             public.ticket_status not null default 'open',
  current_engineer_id uuid references public.engineers(id) on delete set null,
  last_activity_at   timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_tickets_updated
  before update on public.tickets
  for each row execute procedure public.fn_set_updated_at();

create index idx_tickets_status_created on public.tickets(status, received_at desc);

-- ============================================================================
-- TICKET ACTIONS (journal of everything that happens to a ticket)
-- ============================================================================
create table public.ticket_actions (
  id                uuid primary key default gen_random_uuid(),
  ticket_id         uuid not null references public.tickets(id) on delete cascade,
  action_type       public.action_type not null,
  actor_engineer_id uuid references public.engineers(id) on delete set null,
  actor_external_id text,             -- For user messages: Slack/TG user id
  escalation_method public.escalation_method,
  escalation_needed boolean,          -- Whether LLM or human required escalation
  severity          numeric check (severity >= 0 and severity <= 1),
  retry_count       integer not null default 0,
  content           text,             -- Raw text sent/received
  thinking_data     jsonb,            -- LLM thoughts / metadata
  created_at        timestamptz not null default now()
);

create index idx_ticket_actions_ticket on public.ticket_actions(ticket_id, created_at); 