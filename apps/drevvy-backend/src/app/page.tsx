import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Drevvy</h1>
        <p className="text-muted-foreground">
          Shoppers use the Autogentic app. The agent negotiates an out-the-door price and keeps the store hidden.
        </p>
        <p>
          <Link href="/admin" className="underline underline-offset-4">
            Operator sign-in
          </Link>
        </p>
      </div>
    </main>
  );
}
