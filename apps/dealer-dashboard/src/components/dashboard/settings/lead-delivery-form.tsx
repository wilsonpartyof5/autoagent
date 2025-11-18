"use client";

import { useState, useTransition } from "react";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { updateLeadDeliverySettings } from "@/app/app/settings/actions";

type Props = {
  currentMethod?: 'http' | 'email' | null;
  currentEndpoint?: string | null;
  currentEmail?: string | null;
};

export function LeadDeliveryForm({ currentMethod, currentEndpoint, currentEmail }: Props) {
  const [deliveryMethod, setDeliveryMethod] = useState<'http' | 'email' | ''>(currentMethod || '');
  const [endpoint, setEndpoint] = useState(currentEndpoint ?? "");
  const [email, setEmail] = useState(currentEmail ?? "");
  const [feedback, setFeedback] = useState<{ variant: "success" | "error"; message: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    // Validate based on selected method
    if (deliveryMethod === 'http' && !endpoint.trim()) {
      setFeedback({
        variant: "error",
        message: "Enter your HTTP endpoint URL when using HTTP delivery.",
      });
      return;
    }

    if (deliveryMethod === 'email' && !email.trim()) {
      setFeedback({
        variant: "error",
        message: "Enter your email address when using email delivery.",
      });
      return;
    }

    // Validate URL format if HTTP
    if (deliveryMethod === 'http' && endpoint.trim()) {
      try {
        new URL(endpoint.trim());
      } catch {
        setFeedback({
          variant: "error",
          message: "Please enter a valid URL (e.g., https://your-crm.com/webhook/leads).",
        });
        return;
      }
    }

    // Validate email format if Email
    if (deliveryMethod === 'email' && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setFeedback({
          variant: "error",
          message: "Please enter a valid email address.",
        });
        return;
      }
    }

    startTransition(async () => {
      try {
        await updateLeadDeliverySettings({
          method: deliveryMethod === '' ? null : deliveryMethod,
          endpoint: deliveryMethod === 'http' ? endpoint.trim() : null,
          email: deliveryMethod === 'email' ? email.trim() : null,
        });

        setFeedback({
          variant: "success",
          message: "Lead delivery settings saved successfully.",
        });
      } catch (error) {
        setFeedback({
          variant: "error",
          message:
            error instanceof Error ? error.message : "We couldn't save your changes. Try again.",
        });
      }
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Lead Delivery</h2>
        <p className="text-sm text-muted-foreground">
          Configure how leads are delivered to your CRM. AutoAgent generates ADF XML format compatible
          with most automotive CRM systems.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Delivery Method
          </label>
          <select
            value={deliveryMethod}
            onChange={(e) => {
              const value = e.target.value as 'http' | 'email' | '';
              setDeliveryMethod(value);
              setFeedback(null);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Not configured</option>
            <option value="http">HTTP Endpoint</option>
            <option value="email">Email</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Choose how leads should be delivered to your CRM system.
          </p>
        </div>

        {deliveryMethod === 'http' && (
          <Field
            label="HTTP Endpoint URL"
            required
            value={endpoint}
            onChange={setEndpoint}
            placeholder="https://your-crm.com/webhook/leads"
            helper={
              <>
                Your CRM's webhook URL that accepts ADF XML. Contact your CRM provider to obtain this
                endpoint. Common formats: <code className="text-xs">https://your-crm.com/api/leads</code> or{" "}
                <code className="text-xs">https://your-crm.com/webhook/adf</code>
              </>
            }
          />
        )}

        {deliveryMethod === 'email' && (
          <Field
            label="Email Address"
            required
            value={email}
            onChange={setEmail}
            placeholder="leads@yourdealership.com"
            helper="Leads will be sent as ADF XML attachments to this email address."
          />
        )}
      </div>

      {deliveryMethod && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Delivery Format</p>
          <p>
            Leads are delivered in <strong>ADF XML format</strong> (AutoLead Data Format), an industry
            standard supported by most automotive CRM systems including DealerSocket, CDK, Reynolds &amp;
            Reynolds, and others.
          </p>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.variant === "success"
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {deliveryMethod === 'http' && "Test your endpoint using a tool like httpbin.org/post"}
          {deliveryMethod === 'email' && "Ensure your email server accepts XML attachments"}
          {!deliveryMethod && "Configure lead delivery to start receiving leads in your CRM"}
        </p>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Lead Delivery Settings"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  helper,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  helper?: string | ReactNode;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
      />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

