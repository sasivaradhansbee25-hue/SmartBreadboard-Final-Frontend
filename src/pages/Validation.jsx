import React, { useState, useEffect } from 'react';
import ValidationSummaryHeader from '../components/Validation/ValidationSummaryHeader';
import BenchmarkGrid from '../components/Validation/BenchmarkGrid';
import CaseDetailModal from '../components/Validation/CaseDetailModal';
import SoftwareVsPhysicalView from '../components/Validation/SoftwareVsPhysicalView';
import FailureInjectionView from '../components/Validation/FailureInjectionView';
import ValidationReportViewer from '../components/Validation/ValidationReportViewer';
import PhysicalValidationPanel from '../components/PhysicalValidationPanel';
import {
  fetchValidationSummary,
  fetchValidationBenchmarks,
  fetchFailureInjectionScenarios,
  fetchValidationReport
} from '../services/validationService';

export default function Validation() {
  const [activeTab, setActiveTab] = useState('benchmarks');
  const [summary, setSummary] = useState(null);
  const [benchmarks, setBenchmarks] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [report, setReport] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [sumData, bmData, scData, repData] = await Promise.all([
          fetchValidationSummary(),
          fetchValidationBenchmarks(),
          fetchFailureInjectionScenarios(),
          fetchValidationReport()
        ]);
        setSummary(sumData);
        setBenchmarks(bmData);
        setScenarios(scData);
        setReport(repData);
      } catch (err) {
        console.error("Failed to load validation dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#090d16',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <ValidationSummaryHeader
        summary={summary}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Body */}
      <div style={{ flex: 1 }}>
        {isLoading ? (
          <div style={{
            padding: '4rem',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '0.85rem'
          }}>
            Loading validation benchmark suite...
          </div>
        ) : (
          <>
            {activeTab === 'benchmarks' && (
              <BenchmarkGrid
                benchmarks={benchmarks}
                onInspectCase={(c) => setSelectedCase(c)}
              />
            )}

            {activeTab === 'hardware-calibration' && (
              <PhysicalValidationPanel />
            )}

            {activeTab === 'comparison' && (
              <SoftwareVsPhysicalView />
            )}

            {activeTab === 'failure-injection' && (
              <FailureInjectionView scenarios={scenarios} />
            )}

            {activeTab === 'report' && (
              <ValidationReportViewer
                reportData={report}
                benchmarks={benchmarks}
              />
            )}
          </>
        )}
      </div>

      {/* Case Detail Modal */}
      {selectedCase && (
        <CaseDetailModal
          caseData={selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </div>
  );
}
