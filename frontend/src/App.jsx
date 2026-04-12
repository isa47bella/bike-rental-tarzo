import { Routes, Route } from 'react-router-dom';
import BookingWizard   from './components/BookingWizard.jsx';
import AdminDashboard  from './components/AdminDashboard.jsx';
import SuccessPage     from './pages/Success.jsx';
import CancelPage      from './pages/Cancel.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/"        element={<BookingWizard />} />
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/cancel"  element={<CancelPage />} />
      <Route path="/admin"   element={<AdminDashboard />} />
    </Routes>
  );
}
