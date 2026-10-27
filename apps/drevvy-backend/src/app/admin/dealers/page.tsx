import { DEMO_GROUP, DEMO_ROOFTOPS, TERMS_VERSION } from '@/lib/dealer/demo-org';

export const metadata = { title: 'Dealers | Drevvy Admin' };

export default function AdminDealersPage() {
  return (
    <div className="g card">
      <table className="tbl">
        <thead>
          <tr>
            <th>Group</th>
            <th>Rooftop</th>
            <th>Members</th>
            <th>Median reply</th>
            <th>Sold MTD</th>
            <th>Terms</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_ROOFTOPS.map(rooftop => (
            <tr key={rooftop.id}>
              <td>{DEMO_GROUP.name}</td>
              <td>{rooftop.name}</td>
              <td>{rooftop.id === 'lakeside' ? 4 : rooftop.id === 'midtown' ? 3 : 2}</td>
              <td>{rooftop.id === 'airport' ? '31m' : rooftop.id === 'midtown' ? '8m' : '4m'}</td>
              <td>{rooftop.id === 'lakeside' ? 5 : rooftop.id === 'midtown' ? 4 : 2}</td>
              <td>
                <span className="chip c-sold">{TERMS_VERSION}</span>
              </td>
            </tr>
          ))}
          <tr>
            <td>Northside Motors</td>
            <td>Northside Honda</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>
              <span className="chip c-wait">Pending</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
