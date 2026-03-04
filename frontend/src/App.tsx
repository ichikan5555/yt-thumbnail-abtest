import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import NewTest from "./pages/NewTest";
import TestDetail from "./pages/TestDetail";
import Results from "./pages/Results";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Company from "./pages/Company";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import CrossAnalysis from "./pages/CrossAnalysis";
import Competitor from "./pages/Competitor";

export default function App() {
  return (
    <Routes>
      {/* Public: サイドバーなし */}
      <Route path="/lp" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/company" element={<Company />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/contact" element={<Contact />} />

      {/* Protected: サイドバー付き（要ログイン） */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewTest />} />
          <Route path="/tests/:id" element={<TestDetail />} />
          <Route path="/tests/:id/results" element={<Results />} />
          <Route path="/cross-analysis" element={<CrossAnalysis />} />
          <Route path="/competitor" element={<Competitor />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
        </Route>
      </Route>
    </Routes>
  );
}
