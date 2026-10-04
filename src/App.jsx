import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import { CircuitProvider } from './context/CircuitContext';
import Layout from './components/Layout';

import Home from './pages/Home';
import LiveCamera from './pages/LiveCamera';
import Scanner from './pages/Scanner';
import MobileScanner from './pages/MobileScanner';
import CircuitDiagramAR from './pages/CircuitDiagramAR';

import Analysis from './pages/Analysis';
import Simulator from './pages/Simulator';
import Results from './pages/Results';

export default function App() {
  return (
    <CircuitProvider>
      <Router>

        <Routes>

          {/* Phone QR scanner */}
          <Route
            path="/scanner-mobile"
            element={<MobileScanner />}
          />

          {/* Main SmartBreadboard application */}
          <Route
            path="*"
            element={
              <Layout>
                <Routes>

                  {/* Home */}
                  <Route
                    path="/"
                    element={<Home />}
                  />

                  {/* PHASE 1 — Single Photo Scanner */}
                  <Route
                    path="/scanner"
                    element={<Scanner />}
                  />

                  {/* PHASE 2 — Live Camera */}
                  <Route
                    path="/live-camera"
                    element={<LiveCamera />}
                  />

                  {/* PHASE 3 — Real Hardware / AR */}
                  <Route
                    path="/circuit-ar"
                    element={<CircuitDiagramAR />}
                  />

                  {/* Simulation */}
                  <Route
                    path="/analysis"
                    element={<Analysis />}
                  />

                  <Route
                    path="/simulator"
                    element={<Simulator />}
                  />

                  <Route
                    path="/results"
                    element={<Results />}
                  />

                  {/* Existing motor trainer preserved */}
                  <Route
                    path="/motor-trainer"
                    element={<CircuitDiagramAR />}
                  />

                </Routes>
              </Layout>
            }
          />

        </Routes>

      </Router>
    </CircuitProvider>
  );
}