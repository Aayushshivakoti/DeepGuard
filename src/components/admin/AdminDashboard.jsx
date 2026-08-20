import React, { useEffect } from 'react';
import { useApp, ACTIONS } from '../../context/AppContext';
import { getAdminMetrics, getAlertFeed, MOCK_ADMIN_METRICS, MOCK_ALERT_FEED } from '../../api/scanApi';
import MetricCards from './MetricCards';
import ThreatCharts from './ThreatCharts';
import AlertFeed from './AlertFeed';
import AuditTable from './AuditTable';
import SystemSettings from './SystemSettings';

export default function AdminDashboard() {
  const { state, dispatch } = useApp();
  const { adminMetrics, alertFeed } = state;

  useEffect(() => {
    async function fetchData() {
      const [metrics, alerts] = await Promise.all([
        getAdminMetrics(),
        getAlertFeed(),
      ]);
      dispatch({ type: ACTIONS.SET_ADMIN_METRICS, payload: metrics });
      dispatch({ type: ACTIONS.SET_ALERT_FEED, payload: alerts });
    }
    if (!adminMetrics) {
      fetchData();
    }
  }, [adminMetrics, dispatch]);

  const metrics = adminMetrics || MOCK_ADMIN_METRICS;
  const alerts = alertFeed?.length ? alertFeed : MOCK_ALERT_FEED;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Section: Global Metrics */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-1 h-5 rounded-full"
            style={{ background: 'linear-gradient(180deg, #06b6d4, #8b5cf6)' }}
          />
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Global Metrics Overview</h2>
        </div>
        <MetricCards metrics={metrics} />
      </section>

      {/* Section: Charts */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-1 h-5 rounded-full"
            style={{ background: 'linear-gradient(180deg, #8b5cf6, #06b6d4)' }}
          />
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Threat Analytics</h2>
        </div>
        <ThreatCharts metrics={metrics} />
      </section>

      {/* Section: Live Feed + Audit */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-1 h-5 rounded-full"
            style={{ background: 'linear-gradient(180deg, #ef4444, #f59e0b)' }}
          />
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Live Intelligence</h2>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AlertFeed alerts={alerts} />
          <AuditTable cases={metrics.borderline_cases || []} />
        </div>
      </section>

      {/* Section: Settings */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-1 h-5 rounded-full"
            style={{ background: 'linear-gradient(180deg, #22c55e, #06b6d4)' }}
          />
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">System Configuration</h2>
        </div>
        <SystemSettings />
      </section>
    </div>
  );
}
