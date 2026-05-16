import { Routes, Route } from 'react-router-dom';
import BookingWizard   from './components/BookingWizard.jsx';
import AdminDashboard  from './components/AdminDashboard.jsx';
import SuccessPage     from './pages/Success.jsx';
import CancelPage      from './pages/Cancel.jsx';
import FirmaPage       from './pages/Firma.jsx';
import PrivacyPage     from './pages/Privacy.jsx';
import CookieBanner    from './components/CookieBanner.jsx';

function Footer() {
  return (
    <footer className="site-footer">
      <a href="tel:+393928614635" className="footer-contact">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z"/>
        </svg>
        +39 392 8614635
      </a>
      <span className="footer-divider">·</span>
      <a href="mailto:arfantabikerental@gmail.com" className="footer-contact">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
        arfantabikerental@gmail.com
      </a>
      <span className="footer-divider">·</span>
      <a href="/privacy" className="footer-contact">Privacy & Cookie</a>
    </footer>
  );
}

function PublicLayout({ children }) {
  return (
    <>
      {children}
      <Footer />
      <CookieBanner />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/"        element={<PublicLayout><BookingWizard /></PublicLayout>} />
      <Route path="/success" element={<PublicLayout><SuccessPage /></PublicLayout>} />
      <Route path="/cancel"  element={<PublicLayout><CancelPage /></PublicLayout>} />
      <Route path="/admin"   element={<AdminDashboard />} />
      <Route path="/firma/:id" element={<FirmaPage />} />
      <Route path="/privacy"   element={<PublicLayout><PrivacyPage /></PublicLayout>} />
    </Routes>
  );
}
