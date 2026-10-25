-- =====================================================================
-- 1. TABEL PEMBAYARAN
-- =====================================================================
create table if not exists public.payment_submissions (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  parent_name     text    not null,
  phone           text    not null,
  email           text,
  student_name    text    not null,
  school          text    not null,
  destination     text    not null,
  payment_type    text    not null,
  payment_date    date    not null,
  amount_paid     numeric not null,
  payment_method  text    not null,
  notes           text,
  proof_file      text    not null,
  passport_file   text,
  status          text    not null default 'pending',
  email_sent_at   timestamptz
);

-- Untuk tabel yang sudah ada: tambahkan kolom yang belum ada
alter table public.payment_submissions
  add column if not exists email         text,
  add column if not exists passport_file text,
  add column if not exists email_sent_at timestamptz;

alter table public.payment_submissions
  alter column status     set default 'pending',
  alter column created_at set default now();

-- Hapus kolom "Berita transfer". Aturan panjang lama ikut dilepas karena
-- merujuk kolom itu; aturan barunya dipasang lagi pada blok di bawah.
alter table public.payment_submissions
  drop constraint if exists payment_submissions_length_check;

alter table public.payment_submissions
  drop column if exists transfer_note;

-- Aturan data (hanya ditambahkan bila belum ada)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_submissions_status_check'
      and conrelid = 'public.payment_submissions'::regclass
  ) then
    alter table public.payment_submissions
      add constraint payment_submissions_status_check
      check (status in ('pending', 'verified', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_submissions_amount_check'
      and conrelid = 'public.payment_submissions'::regclass
  ) then
    alter table public.payment_submissions
      add constraint payment_submissions_amount_check
      check (amount_paid >= 1 and amount_paid <= 10000000000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_submissions_length_check'
      and conrelid = 'public.payment_submissions'::regclass
  ) then
    alter table public.payment_submissions
      add constraint payment_submissions_length_check
      check (
        char_length(parent_name)      <= 120
        and char_length(student_name) <= 120
        and char_length(school)       <= 160
        and char_length(phone)        <= 30
        and (email is null or char_length(email) <= 160)
        and (notes is null or char_length(notes) <= 1000)
      );
  end if;

  -- Nama file hanya boleh UUID + ekstensi (mencegah path traversal)
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_submissions_files_check'
      and conrelid = 'public.payment_submissions'::regclass
  ) then
    alter table public.payment_submissions
      add constraint payment_submissions_files_check
      check (
        proof_file ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$'
        and (passport_file is null
             or passport_file ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$')
      );
  end if;
end
$$;

create index if not exists payment_submissions_created_idx
  on public.payment_submissions (created_at desc);

create index if not exists payment_submissions_status_idx
  on public.payment_submissions (status);

-- =====================================================================
-- 2. RLS TABEL PEMBAYARAN
--    Tanpa policy = kunci publik (anon/authenticated) ditolak total.
--    Server memakai service_role yang mengabaikan RLS.
-- =====================================================================
alter table public.payment_submissions enable row level security;

revoke all on table public.payment_submissions from public, anon, authenticated;
grant select, insert, update, delete
  on table public.payment_submissions to service_role;
grant usage, select on all sequences in schema public to service_role;

-- =====================================================================
-- 3. BUCKET STORAGE (PRIVAT)
--    Folder Payments dan Passports otomatis terbentuk saat file
--    pertama diunggah ke path tersebut.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- RLS storage.objects aktif bawaan Supabase. Tanpa policy untuk bucket ini,
-- hanya service_role (server) yang bisa membaca/menulis file.

-- =====================================================================
-- 4. TABEL USER ADMIN
-- =====================================================================
create table if not exists public.app_users (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null,
  full_name             text not null,
  password_hash         text not null,
  role                  text not null default 'admin',
  is_active             boolean not null default true,
  session_version       integer not null default 1,
  failed_login_attempts integer not null default 0,
  locked_until          timestamptz,
  last_login_at         timestamptz,
  password_changed_at   timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.app_users(id) on delete set null,

  constraint app_users_email_format check (
    email = lower(btrim(email))
    and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
  ),
  constraint app_users_role_check check (role in ('viewer', 'admin', 'super_admin')),
  constraint app_users_name_len check (char_length(btrim(full_name)) between 1 and 120)
);

create unique index if not exists app_users_email_key on public.app_users (email);

comment on table public.app_users is
  'Akun login portal admin. Hanya boleh diakses lewat service_role dari server.';
comment on column public.app_users.role is
  'viewer = hanya lihat, admin = verifikasi/tolak pembayaran, super_admin = kelola user';

-- updated_at + invalidasi sesi saat password/status aktif berubah
create or replace function public.app_users_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();

  if new.password_hash is distinct from old.password_hash then
    new.password_changed_at   := now();
    new.session_version       := old.session_version + 1;
    new.failed_login_attempts := 0;
    new.locked_until          := null;
  end if;

  if new.is_active is distinct from old.is_active then
    new.session_version := old.session_version + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists app_users_before_update on public.app_users;
create trigger app_users_before_update
  before update on public.app_users
  for each row execute function public.app_users_before_update();

-- super_admin aktif terakhir tidak boleh hilang
create or replace function public.app_users_protect_last_super_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role = 'super_admin' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'super_admin' or not new.is_active) then
    if not exists (
      select 1 from public.app_users
      where role = 'super_admin' and is_active and id <> old.id
    ) then
      raise exception 'Tidak boleh menghapus, menonaktifkan, atau menurunkan super_admin aktif terakhir.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists app_users_protect_last_super_admin on public.app_users;
create trigger app_users_protect_last_super_admin
  before update or delete on public.app_users
  for each row execute function public.app_users_protect_last_super_admin();

-- Catat login gagal secara atomik (kunci akun otomatis)
create or replace function public.record_login_failure(
  p_user_id      uuid,
  p_max_attempts integer default 5,
  p_lock_minutes integer default 15
)
returns void
language sql
set search_path = public
as $$
  update public.app_users u
     set failed_login_attempts = n.attempts,
         locked_until = case
           when n.attempts >= p_max_attempts
             then now() + make_interval(mins => p_lock_minutes)
           else u.locked_until
         end
    from (
      select id,
             case
               when locked_until is not null and locked_until <= now() then 1
               else failed_login_attempts + 1
             end as attempts
        from public.app_users
       where id = p_user_id
    ) n
   where u.id = n.id;
$$;

-- RLS + hak akses tabel user
alter table public.app_users enable row level security;

revoke all on table public.app_users from public, anon, authenticated;
grant select, insert, update, delete on table public.app_users to service_role;

revoke all on function public.record_login_failure(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.record_login_failure(uuid, integer, integer)
  to service_role;

-- Tabel user TIDAK boleh disiarkan lewat Realtime
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_users'
  ) then
    alter publication supabase_realtime drop table public.app_users;
  end if;
end
$$;

-- =====================================================================
-- 5. REALTIME DASHBOARD (aman: siaran hanya berisi id dan jenis perubahan)
--    Tidak ada nama, nomor, email, atau data pribadi yang disiarkan.
--    Dashboard cukup memuat ulang data lewat API yang sudah login.
--    Kegagalan siaran tidak akan pernah menggagalkan penyimpanan data.
-- =====================================================================
create or replace function public.notify_submission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if tg_op = 'DELETE' then
    v_id := old.id;
  else
    v_id := new.id;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object('op', tg_op, 'id', v_id),
      'submission_changed',
      'admin-submissions',
      false
    );
  exception when others then
    raise warning 'notify_submission_change gagal: %', sqlerrm;
  end;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_submission_change() from public, anon, authenticated;

drop trigger if exists payment_submissions_notify on public.payment_submissions;
create trigger payment_submissions_notify
  after insert or update or delete on public.payment_submissions
  for each row execute function public.notify_submission_change();

-- =====================================================================
-- 6. SEGARKAN CACHE SKEMA API
-- =====================================================================
notify pgrst, 'reload schema';