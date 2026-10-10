-- Add status column to leads table
alter table leads add column if not exists status text default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'test_drive_booked'));

-- Add replied_at and closed_at columns for tracking
alter table leads add column if not exists replied_at timestamptz;
alter table leads add column if not exists closed_at timestamptz;

-- Add source column
alter table leads add column if not exists source text default 'chatgpt';

