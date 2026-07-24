import { Route, Routes } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AssessmentStartPage } from './pages/AssessmentStartPage';
import { UniversityPickerPage } from './pages/UniversityPickerPage';
import { WizardPage } from './pages/WizardPage';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import './App.css';

function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/assessment" element={<AssessmentStartPage />} />
          <Route path="/assessment/universities" element={<UniversityPickerPage />} />
          <Route path="/assessment/wizard" element={<WizardPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
