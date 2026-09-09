-- Shared dictionary: one row per unique word, across all users.
create table words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  meaning text not null,
  example text not null,
  note text,
  say text not null,
  ipa text not null,
  emoji text,
  source text not null check (source in ('ai', 'manual')),
  created_at timestamptz not null default now()
);
create unique index words_word_lower_idx on words (lower(word));

alter table words enable row level security;

create policy "words readable by any authenticated user"
  on words for select
  to authenticated
  using (true);

-- words is a shared dictionary with no owner column, so this lets any
-- authenticated user correct any word's content (fixing a typo affects
-- everyone who has that word, by design). Insert/delete still only happen
-- via the add-word Edge Function's service role key.
create policy "authenticated users can edit shared words"
  on words for update
  to authenticated
  using (true)
  with check (true);

-- A user's personal relationship to a word.
create table user_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id uuid not null references words (id) on delete cascade,
  level text not null default 'new' check (level in ('new', 'learning', 'known')),
  streak int not null default 0,
  seen int not null default 0,
  "right" int not null default 0,
  due_at timestamptz not null default now(),
  added_at timestamptz not null default now(),
  unique (user_id, word_id)
);

alter table user_words enable row level security;

create policy "users manage their own words"
  on user_words for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Quiz sessions read the whole list sorted by due_at, so index that.
create index user_words_user_due_idx on user_words (user_id, due_at);

-- ---------------------------------------------------------------------------
-- Added beyond the design doc: the daily cap in section 5 needs somewhere to
-- count. Only words that actually triggered an AI call are counted here —
-- adding a word already in the shared dictionary never touches this table.
-- ---------------------------------------------------------------------------
create table ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table ai_usage enable row level security;
-- No policies at all: written only by the Edge Function's service role.

create or replace function bump_ai_usage(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used int;
begin
  insert into ai_usage (user_id, day, count)
  values (p_user, current_date, 1)
  on conflict (user_id, day)
    do update set count = ai_usage.count + 1
  returning count into used;

  return used <= p_limit;
end;
$$;
