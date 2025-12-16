import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Serves the ChatGPT Apps manifest from the canonical source of truth:
 * apps/autoagent-app/manifest.json
 *
 * This path matches the expected well-known location:
 *   /.well-known/app.json
 */
export async function GET() {
  try {
    const manifestPath = join(process.cwd(), '..', 'autoagent-app', 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error reading manifest.json:', error);
    return NextResponse.json(
      {
        error: 'Manifest not found',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

