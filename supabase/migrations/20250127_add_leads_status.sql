-- Add status column to leads table
-- Uses DO block to safely skip if table doesn't exist yet (will be created by create_leads_table)
do $$
begin
  if exists (select from information_schema.tables where table_name = 'leads' and table_schema = 'public') then
    alter table leads add column if not exists status text default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'test_drive_booked'));
    alter table leads add column if not exists replied_at timestamptz;
    alter table leads add column if not exists closed_at timestamptz;
    alter table leads add column if not exists source text default 'chatgpt';
  end if;
end;
$$;
