import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const DemoRequestSchema = z.object({
  fullName: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  dealership: z.string().optional(),
  role: z.string().optional(),
  interest: z.string().optional(),
  message: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = DemoRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid form submission', details: result.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('demo_requests').insert({
      full_name: result.data.fullName,
      email: result.data.email,
      phone: result.data.phone,
      dealership: result.data.dealership,
      role: result.data.role,
      interest: result.data.interest,
      message: result.data.message,
      source: result.data.source ?? 'marketing-site',
    });

    if (error) {
      return NextResponse.json(
        { error: 'Unable to save request', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
