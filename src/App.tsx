import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import CampagneRouter from './pages/campagne'
import LoginModal from './components/LoginModal'
import ForgotPassword from './components/ForgotPassword'
import PrivacyPolicy from './components/PrivacyPolicy'

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/campagne/*" element={<CampagneRouter />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        </Routes>
        <LoginModal />
      </div>
    </Router>
  )
}

// This is a temporary placeholder that will be replaced with actual file
// const CampagnePage = () => <div>Loading Campagne Page...</div>

export default App
