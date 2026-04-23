import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoanForm from './loan-contract-form';
import AdminDashboard from './AdminDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoanForm />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
