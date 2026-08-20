import React, { createContext, useContext, useReducer, useCallback } from 'react';

// ─── State Shape ──────────────────────────────────────────────────────────────
const initialState = {
  // Scan
  scanResult: null,
  scanStatus: 'idle', // idle | scanning | done | error
  scanProgress: 0,
  scanStepMessage: '',
  isMockData: false,
  // History
  scanHistory: [],
  historyOpen: false,
  // Admin
  adminMetrics: null,
  alertFeed: [],
  // UI
  activeView: 'workspace', // workspace | admin
  activeTab: 'image',      // image | video | audio | pdf | url
};

// ─── Action Types ─────────────────────────────────────────────────────────────
export const ACTIONS = {
  SET_SCAN_STATUS: 'SET_SCAN_STATUS',
  SET_SCAN_RESULT: 'SET_SCAN_RESULT',
  SET_SCAN_PROGRESS: 'SET_SCAN_PROGRESS',
  SET_SCAN_STEP: 'SET_SCAN_STEP',
  RESET_SCAN: 'RESET_SCAN',
  ADD_TO_HISTORY: 'ADD_TO_HISTORY',
  SET_HISTORY: 'SET_HISTORY',
  TOGGLE_HISTORY: 'TOGGLE_HISTORY',
  SET_ADMIN_METRICS: 'SET_ADMIN_METRICS',
  SET_ALERT_FEED: 'SET_ALERT_FEED',
  ADD_ALERT: 'ADD_ALERT',
  SET_ACTIVE_VIEW: 'SET_ACTIVE_VIEW',
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  SET_MOCK_DATA: 'SET_MOCK_DATA',
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function appReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_SCAN_STATUS:
      return { ...state, scanStatus: action.payload };
    case ACTIONS.SET_SCAN_RESULT:
      return { ...state, scanResult: action.payload, scanStatus: 'done' };
    case ACTIONS.SET_SCAN_PROGRESS:
      return { ...state, scanProgress: action.payload };
    case ACTIONS.SET_SCAN_STEP:
      return { ...state, scanStepMessage: action.payload };
    case ACTIONS.RESET_SCAN:
      return { ...state, scanResult: null, scanStatus: 'idle', scanProgress: 0, scanStepMessage: '', isMockData: false };
    case ACTIONS.ADD_TO_HISTORY:
      return { ...state, scanHistory: [action.payload, ...state.scanHistory].slice(0, 50) };
    case ACTIONS.SET_HISTORY:
      return { ...state, scanHistory: action.payload };
    case ACTIONS.TOGGLE_HISTORY:
      return { ...state, historyOpen: !state.historyOpen };
    case ACTIONS.SET_ADMIN_METRICS:
      return { ...state, adminMetrics: action.payload };
    case ACTIONS.SET_ALERT_FEED:
      return { ...state, alertFeed: action.payload };
    case ACTIONS.ADD_ALERT:
      return { ...state, alertFeed: [action.payload, ...state.alertFeed].slice(0, 20) };
    case ACTIONS.SET_ACTIVE_VIEW:
      return { ...state, activeView: action.payload };
    case ACTIONS.SET_ACTIVE_TAB:
      return { ...state, activeTab: action.payload };
    case ACTIONS.SET_MOCK_DATA:
      return { ...state, isMockData: action.payload };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setActiveView = useCallback((view) => dispatch({ type: ACTIONS.SET_ACTIVE_VIEW, payload: view }), []);
  const setActiveTab = useCallback((tab) => dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: tab }), []);
  const resetScan = useCallback(() => dispatch({ type: ACTIONS.RESET_SCAN }), []);
  const toggleHistory = useCallback(() => dispatch({ type: ACTIONS.TOGGLE_HISTORY }), []);

  return (
    <AppContext.Provider value={{ state, dispatch, setActiveView, setActiveTab, resetScan, toggleHistory }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
