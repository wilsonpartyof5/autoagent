import { DEALER_ROLES, DEMO_ROOFTOPS, DEMO_TEAM } from '@/lib/dealer/demo-org';

export const metadata = { title: 'Team' };

export default function DealerTeamPage() {
  return (
    <div className="row" style={{ gridTemplateColumns: '1fr' }}>
      <div className="g card invite-grid">
        <div>
          <div className="lab">Work email</div>
          <input className="inp" placeholder="name@lakesidehonda.com" />
        </div>
        <div>
          <div className="lab">Role</div>
          <select className="inp" defaultValue="Salesperson">
            {DEALER_ROLES.map(role => (
              <option key={role.id}>{role.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="lab">Rooftop access</div>
          <div>
            {DEMO_ROOFTOPS.map((rooftop, index) => (
              <span key={rooftop.id} className={`cp${index === 0 ? ' p' : ''}`}>
                {rooftop.name}
                {index === 0 ? ' ✓' : ''}
              </span>
            ))}
          </div>
        </div>
        <span className="btn">Send invite</span>
      </div>
      <div className="g card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Rooftops</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_TEAM.map(person => (
              <tr key={person.name}>
                <td>{person.name}</td>
                <td>
                  <span className="chip c-new">{person.role}</span>
                </td>
                <td>{person.rooftops}</td>
                <td>{person.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
