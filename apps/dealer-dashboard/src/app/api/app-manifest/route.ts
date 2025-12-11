import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Serves the ChatGPT App manifest from the canonical source:
 * apps/autoagent-app/manifest.json
 * 
 * This ensures a single source of truth for the manifest.
 * The static file is the authoritative source for Apps SDK validation.
 */
export async function GET() {
  try {
    // Read manifest from the canonical location
    // Path is relative to project root (one level up from apps/dealer-dashboard)
    const manifestPath = join(process.cwd(), '..', 'autoagent-app', 'manifest.json');
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);
    
    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
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

