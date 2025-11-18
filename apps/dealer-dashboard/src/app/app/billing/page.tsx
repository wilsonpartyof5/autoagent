export default function BillingPage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Billing &amp; Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Review invoices and update payment details. Detailed billing history coming soon.
        </p>
      </header>
      <div className="grid gap-4 rounded-xl border border-dashed border-border/60 p-10 text-center text-muted-foreground">
        Billing summary and invoices will appear here.
      </div>
    </section>
  );
}
