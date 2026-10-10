import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { CircuitProvider } from './context/CircuitContext';

import Home from './pages/Home';
import LiveCamera from './pages/LiveCamera';
import Scanner from './pages/Scanner';
import Analysis from './pages/Analysis';
import Simulator from './pages/Simulator';
import Calculator from './pages/Calculator';
import Results from './pages/Results';
import Learn from './pages/Learn';
import Validation from './pages/Validation';
import PhoneCamera from './pages/PhoneCamera';
import MobileScanner from './pages/MobileScanner';
import CircuitDiagramAR from './pages/CircuitDiagramAR';
import HardwareMonitor from './pages/HardwareMonitor';
import ClipperClamperLab from './pages/ClipperClamperLab';

export default function App() {
  return (
    <CircuitProvider>
      <Router>
        <Routes>
          <Route path="/phone-camera" element={<PhoneCamera />} />
          <Route path="/scanner-mobile" element={<MobileScanner />} />
          <Route path="*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/live-camera" element={<LiveCamera />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/circuit-ar" element={<CircuitDiagramAR />} />
                <Route path="/motor-trainer" element={<CircuitDiagramAR />} />
                <Route path="/hardware-monitor" element={<HardwareMonitor />} />
                <Route path="/dc-motor-monitor" element={<HardwareMonitor />} />
                <Route path="/clipper-clamper-lab" element={<ClipperClamperLab />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/simulator" element={<Simulator />} />
                <Route path="/calculator" element={<Calculator />} />
                <Route path="/results" element={<Results />} />
                <Route path="/learn" element={<Learn />} />
                <Route path="/validation" element={<Validation />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </Router>
    </CircuitProvider>
  );
}

