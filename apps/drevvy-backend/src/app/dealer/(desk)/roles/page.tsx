import { DEALER_ROLES } from '@/lib/dealer/demo-org';

export const metadata = { title: 'Roles' };

export default function DealerRolesPage() {
  return (
    <div className="row pair">
      {DEALER_ROLES.map(role => (
        <article key={role.id} className="g card">
          <span className="chip c-new">{role.label}</span>
          <div className="t" style={{ marginTop: 12 }}>
            {role.scope}
          </div>
          <p className="mut" style={{ marginTop: 8 }}>
            {role.id === 'owner_gm'
              ? 'Sees every rooftop, billing, and team invites.'
              : role.id === 'sales_manager'
                ? 'Rooftop inbox plus the people assigned there.'
                : role.id === 'bdc'
                  ? 'Every conversation at the assigned rooftop.'
                  : 'Only conversations assigned to this salesperson.'}
          </p>
        </article>
      ))}
    </div>
  );
}
