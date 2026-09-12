-- Shared dictionary: one row per unique word or phrase, across all users.
-- Single words come from Word Orb (deterministic lookup, no per-call AI
-- cost). Multi-word phrases are bundled once from a static phrasal-verb
-- dataset (see seed_phrasal_verbs.sql) instead of a live API — there's no
-- rate limit or outage risk for data that never changes. Neither source
-- returns every field, so example/say/ipa/note are nullable — the UI
-- already hides them when absent.
create table words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  meaning text not null,
  example text,
  note text,
  say text,
  ipa text,
  emoji text,
  part_of_speech text,
  source text not null check (source in ('ai', 'manual', 'wordorb', 'phrase')),
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

-- Personal memory tricks — separate from the shared dictionary, never
-- visible to anyone else. `word` is a free-text label the user types, not a
-- foreign key: there's no autocomplete tying it to a real dictionary entry,
-- by design, so it stays optional and freeform.
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  word text,
  color text not null default 'pink' check (color in ('pink', 'purple', 'lime', 'orange', 'white')),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notes enable row level security;

create policy "users manage their own notes"
  on notes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index notes_user_idx on notes (user_id, pinned desc, created_at desc);
