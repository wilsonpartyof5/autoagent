import type { ParsedForm } from './detect';
import { formHasCaptcha, formRequiresPrivateInfo } from './detect';
import {
  isApprovedFill,
  outreachValue,
  type LeadContactMode,
  type OutreachFill,
  type OutreachIdentity,
} from './outreach';

export type FormPlan = {
  title: string;
  formId: string | null;
  buttonText: string | null;
  fills: OutreachFill[];
  stop: 'captcha' | 'private_info' | 'missing_zip' | 'unsupported_field' | null;
};

export function planForm(
  form: ParsedForm,
  identity: OutreachIdentity,
  stockNumber: string | null,
  channel: 'lead_form' | 'prechat',
  mode: LeadContactMode = 'full',
): FormPlan {
  if (formHasCaptcha(form)) {
    return { title: form.title, formId: form.id, buttonText: form.buttonText, fills: [], stop: 'captcha' };
  }
  if (formRequiresPrivateInfo(form)) {
    return { title: form.title, formId: form.id, buttonText: form.buttonText, fills: [], stop: 'private_info' };
  }
  const fills: OutreachFill[] = [];
  for (const field of form.fields) {
    if (field.kind === 'unknown') {
      if (field.required) {
        return { title: form.title, formId: form.id, buttonText: form.buttonText, fills: [], stop: 'unsupported_field' };
      }
      continue;
    }
    if (field.kind === 'private') {
      return { title: form.title, formId: form.id, buttonText: form.buttonText, fills: [], stop: 'private_info' };
    }
    if (mode === 'name_and_phone' && (field.kind === 'last_name' || field.kind === 'email' || field.kind === 'zip')) {
      if (field.required) {
        return { title: form.title, formId: form.id, buttonText: form.buttonText, fills: [], stop: 'unsupported_field' };
      }
      continue;
    }
    const value = outreachValue(field.kind, identity, stockNumber, channel, mode);
    if (!value) {
      if (field.required || field.kind === 'zip') {
        return { title: form.title, formId: form.id, buttonText: form.buttonText, fills: [], stop: 'missing_zip' };
      }
      continue;
    }
    const fill: OutreachFill = { kind: field.kind, name: field.name, id: field.id, value };
    if (!isApprovedFill(fill, identity, stockNumber, channel, mode)) {
      return { title: form.title, formId: form.id, buttonText: form.buttonText, fills: [], stop: 'private_info' };
    }
    fills.push(fill);
  }
  if (!fills.some((fill) => fill.kind === 'phone' || fill.kind === 'email')) {
    return { title: form.title, formId: form.id, buttonText: form.buttonText, fills: [], stop: 'unsupported_field' };
  }
  return { title: form.title, formId: form.id, buttonText: form.buttonText, fills, stop: null };
}

export function describePlan(plan: FormPlan): string {
  if (plan.stop) return `${plan.title || 'form'}: stopped (${plan.stop})`;
  const fields = plan.fills.map((fill) => `${fill.kind}=${fill.value}`).join(' ');
  return `${plan.title || 'form'}: ${fields}`;
}
