export default function Home() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 1rem'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          🚗 AutoAgent
        </h1>
        
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '1.5rem'
        }}>
          Dealer Dashboard
        </h2>
        
        <p style={{
          fontSize: '1.1rem',
          color: '#6b7280',
          marginBottom: '2rem',
          lineHeight: '1.6'
        }}>
          This is a placeholder for the AutoAgent dealer dashboard. 
          The full dashboard will include inventory management, lead tracking, 
          analytics, and billing features.
        </p>
        
        <div style={{
          background: '#f8fafc',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{
            fontSize: '1.2rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '1rem'
          }}>
            Coming Soon
          </h3>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            color: '#6b7280'
          }}>
            <li style={{ marginBottom: '0.5rem' }}>📊 Analytics & Reporting</li>
            <li style={{ marginBottom: '0.5rem' }}>🚗 Inventory Management</li>
            <li style={{ marginBottom: '0.5rem' }}>👥 Lead Management</li>
            <li style={{ marginBottom: '0.5rem' }}>💳 Billing & Subscriptions</li>
            <li style={{ marginBottom: '0.5rem' }}>⚙️ Settings & Configuration</li>
          </ul>
        </div>
        
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#dbeafe',
          borderRadius: '8px',
          border: '1px solid #93c5fd'
        }}>
          <p style={{
            fontSize: '0.9rem',
            color: '#1e40af',
            margin: 0
          }}>
            <strong>Status:</strong> Placeholder - Development in progress
          </p>
        </div>
      </div>
    </div>
  );
}
