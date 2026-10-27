import { TERMS_LOG } from '@/lib/dealer/demo-org';

export const metadata = { title: 'Terms log | Drevvy Admin' };

export default function AdminTermsLogPage() {
  return (
    <div className="g card">
      <table className="tbl">
        <thead>
          <tr>
            <th>When (ET)</th>
            <th>User</th>
            <th>Role</th>
            <th>Rooftop(s)</th>
            <th>Version</th>
            <th>Method</th>
          </tr>
        </thead>
        <tbody>
          {TERMS_LOG.map(row => (
            <tr key={`${row.user}-${row.whenEt}`}>
              <td>{row.whenEt}</td>
              <td>{row.user}</td>
              <td>{row.role}</td>
              <td>{row.rooftops}</td>
              <td>{row.version}</td>
              <td>{row.method}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
