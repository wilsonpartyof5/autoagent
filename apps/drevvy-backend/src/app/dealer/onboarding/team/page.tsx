import { OnboardingFrame, OnboardingNav } from '@/components/dealer/onboarding-frame';
import { DEALER_ROLES } from '@/lib/dealer/demo-org';

export const metadata = { title: 'Invite team' };

export default function OnboardingTeamPage() {
  return (
    <OnboardingFrame step="team">
      <div className="g card" style={{ padding: 28 }}>
        <div className="h1">Invite your team</div>
        <p className="mut" style={{ margin: '6px 0 14px' }}>
          You’re <b>Owner/GM</b>. Pick a role and rooftops for each teammate.
        </p>
        {[
          { email: 'omar@airportkia.com', role: 'Sales Manager' },
          { email: 'lena@lakesideauto.com', role: 'BDC' },
          { email: 'chris@lakesidehonda.com', role: 'Salesperson' },
        ].map(row => (
          <div
            key={row.email}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <input className="inp" defaultValue={row.email} />
            <select className="inp" defaultValue={row.role}>
              {DEALER_ROLES.map(role => (
                <option key={role.id}>{role.label}</option>
              ))}
            </select>
          </div>
        ))}
        <div className="note" style={{ marginTop: 8 }}>
          Salesperson: own conversations · BDC: all rooftop chats · Sales
          Manager: rooftop + team · Owner/GM: cross-rooftop + billing.
        </div>
        <OnboardingNav
          backHref="/dealer/onboarding/rooftops"
          nextHref="/dealer/onboarding/routing"
          nextLabel="Send invites"
        />
      </div>
    </OnboardingFrame>
  );
}
