import { DEMO_GROUP, DEMO_ROOFTOPS, TERMS_VERSION } from '@/lib/dealer/demo-org';

export const metadata = { title: 'Rooftops' };

export default function DealerRooftopsPage() {
  return (
    <div className="g card">
      <p className="mut" style={{ marginBottom: 12 }}>
        {DEMO_GROUP.name} · groups own rooftops. Owner/GM can switch across
        them in the top bar.
      </p>
      <table className="tbl">
        <thead>
          <tr>
            <th>Rooftop</th>
            <th>City</th>
            <th>Hours</th>
            <th>Doc fee</th>
            <th>Inventory</th>
            <th>Terms</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_ROOFTOPS.map(rooftop => (
            <tr key={rooftop.id}>
              <td>{rooftop.name}</td>
              <td>{rooftop.city}</td>
              <td>{rooftop.hours}</td>
              <td>{rooftop.docFee}</td>
              <td>{rooftop.vehicles}</td>
              <td>
                <span className="chip c-sold">{TERMS_VERSION}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
