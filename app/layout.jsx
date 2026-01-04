export const metadata = {
  title: 'Unami Moments - Community Engagement Platform',
  description: '100% WhatsApp-native community engagement platform for South Africa',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <style jsx global>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 1100px; margin: 0 auto; padding: 0 12px; }
          .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
          .btn-primary { background: #2563eb; color: white; }
          .btn-primary:hover { background: #1d4ed8; }
          .card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 16px; }
          @media (max-width: 768px) {
            .container { padding: 0 8px; }
            .nav-desktop { display: none; }
            .nav-mobile { display: flex; }
          }
          @media (min-width: 769px) {
            .nav-desktop { display: flex; }
            .nav-mobile { display: none; }
          }
        `}</style>
      </head>
      <body>
        <header style={{padding: '12px 0', background: '#2563eb', color: 'white', position: 'sticky', top: 0, zIndex: 100}}>
          <div className="container">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
              <h1 style={{fontSize: '1.2rem', margin: 0, fontWeight: 600}}>🌍 Unami Moments</h1>
              <nav className="nav-desktop" style={{display: 'flex', gap: '16px'}}>
                <a href="/" style={{color: 'white', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s'}}>Home</a>
                <a href="/moments" style={{color: 'white', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s'}}>Moments</a>
                <a href="/campaigns" style={{color: 'white', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s'}}>Campaigns</a>
                <a href="/sponsors" style={{color: 'white', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s'}}>Sponsors</a>
                <a href="/broadcasts" style={{color: 'white', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s'}}>Broadcasts</a>
                <a href="/settings" style={{color: 'white', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s'}}>Settings</a>
              </nav>
            </div>
            <nav className="nav-mobile" style={{display: 'none', justifyContent: 'space-around', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px'}}>
              <a href="/" style={{color: 'white', textDecoration: 'none', fontSize: '12px', textAlign: 'center', flex: 1}}>🏠<br/>Home</a>
              <a href="/moments" style={{color: 'white', textDecoration: 'none', fontSize: '12px', textAlign: 'center', flex: 1}}>📢<br/>Moments</a>
              <a href="/campaigns" style={{color: 'white', textDecoration: 'none', fontSize: '12px', textAlign: 'center', flex: 1}}>🎯<br/>Campaigns</a>
              <a href="/sponsors" style={{color: 'white', textDecoration: 'none', fontSize: '12px', textAlign: 'center', flex: 1}}>🏢<br/>Sponsors</a>
              <a href="/broadcasts" style={{color: 'white', textDecoration: 'none', fontSize: '12px', textAlign: 'center', flex: 1}}>📡<br/>Broadcasts</a>
              <a href="/settings" style={{color: 'white', textDecoration: 'none', fontSize: '12px', textAlign: 'center', flex: 1}}>⚙️<br/>Settings</a>
            </nav>
          </div>
        </header>
        <main className="container" style={{marginTop: '20px', marginBottom: '20px', minHeight: 'calc(100vh - 120px)'}}>
          {children}
        </main>
        <footer style={{background: '#f8f9fa', padding: '16px 0', borderTop: '1px solid #e9ecef', marginTop: '40px'}}>
          <div className="container" style={{textAlign: 'center', fontSize: '14px', color: '#6c757d'}}>
            <p>© 2024 Unami Foundation | <a href="/admin.html" style={{color: '#2563eb'}}>Admin Dashboard</a></p>
          </div>
        </footer>
      </body>
    </html>
  );
}
