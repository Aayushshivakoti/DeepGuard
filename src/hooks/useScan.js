import { useCallback } from 'react';
import { useApp, ACTIONS } from '../context/AppContext';
import { scanFile, scanUrl, getScanJobStatus } from '../api/scanApi';
import { useToast } from '../context/ToastContext';

export function useScan() {
  const { dispatch } = useApp();
  const { addToast } = useToast();

  const runScan = useCallback(async (file, mediaType) => {
    dispatch({ type: ACTIONS.SET_SCAN_STATUS, payload: 'scanning' });
    dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: 5 });
    dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: 'Uploading media buffer...' });

    try {
      const { data, isMock } = await scanFile(file, mediaType);
      
      // If it is mock or returned instantly (not async job)
      if (isMock || data.model_version !== "Celery-Background") {
        dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: 100 });
        dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: 'Analysis complete.' });
        dispatch({ type: ACTIONS.SET_MOCK_DATA, payload: isMock });
        await new Promise(r => setTimeout(r, 400));
        dispatch({ type: ACTIONS.SET_SCAN_RESULT, payload: data });
        dispatch({ type: ACTIONS.ADD_TO_HISTORY, payload: { ...data, filename: file.name } });
        addToast(`Forensic scan completed for ${file.name}`, 'success');
        return;
      }

      const jobId = data.id;

      // ─── WebSocket Connection for Real-Time Progression ──────────────────
      try {
        await new Promise((resolve, reject) => {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${protocol}//${import.meta.env.VITE_WS_URL || 'localhost:8000/api/v1/ws'}/scans/${jobId}`;
          const socket = new WebSocket(wsUrl);
          let hasEnded = false;

          socket.onmessage = (event) => {
            try {
              const statusUpdate = JSON.parse(event.data);
              const jobStatus = statusUpdate.status;
              
              if (statusUpdate.progress) {
                dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: statusUpdate.progress });
              }
              if (statusUpdate.message) {
                dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: statusUpdate.message });
              }

              if (jobStatus === "SUCCESS" && statusUpdate.result) {
                hasEnded = true;
                const finalResult = statusUpdate.result;
                dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: 100 });
                dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: 'Forensic evaluation successful.' });
                setTimeout(() => {
                  dispatch({ type: ACTIONS.SET_SCAN_RESULT, payload: finalResult });
                  dispatch({ type: ACTIONS.ADD_TO_HISTORY, payload: { ...finalResult, filename: file.name } });
                  addToast(`Forensic verification successful for ${file.name}`, 'success');
                  socket.close();
                  resolve();
                }, 400);
              } else if (jobStatus === "FAILED" || jobStatus === "FAILURE") {
                hasEnded = true;
                socket.close();
                reject(new Error(statusUpdate.message || "Background verification task failed."));
              }
            } catch (err) {
              console.error("WS payload parse error:", err);
            }
          };

          socket.onerror = (err) => {
            if (!hasEnded) {
              socket.close();
              reject(new Error("WebSocket connection error."));
            }
          };

          socket.onclose = () => {
            if (!hasEnded) {
              reject(new Error("WebSocket closed unexpectedly."));
            }
          };
        });
      } catch (wsError) {
        console.warn("WebSocket failed, falling back to polling...", wsError);
        
        // ─── Fallback HTTP Polling ──────────────────────────────────────────
        let jobStatus = "PENDING";
        let retries = 0;
        const maxRetries = 100;

        while (jobStatus === "PENDING" || jobStatus === "PROCESSING") {
          await new Promise(r => setTimeout(r, 2000));
          const statusUpdate = await getScanJobStatus(jobId);
          jobStatus = statusUpdate.status || "PENDING";
          
          if (statusUpdate.progress) {
            dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: statusUpdate.progress });
          }
          if (statusUpdate.message) {
            dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: statusUpdate.message });
          }

          if (jobStatus === "SUCCESS" && statusUpdate.result) {
            const finalResult = statusUpdate.result;
            dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: 100 });
            dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: 'Forensic evaluation successful.' });
            await new Promise(r => setTimeout(r, 400));
            dispatch({ type: ACTIONS.SET_SCAN_RESULT, payload: finalResult });
            dispatch({ type: ACTIONS.ADD_TO_HISTORY, payload: { ...finalResult, filename: file.name } });
            addToast(`Forensic verification successful for ${file.name}`, 'success');
            return;
          } else if (jobStatus === "FAILURE") {
            throw new Error(statusUpdate.error || "Background verification task failed.");
          }
        }
      }

    } catch (err) {
      console.error("Scan failed:", err);
      dispatch({ type: ACTIONS.SET_SCAN_STATUS, payload: 'error' });
      dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: err.message || 'Scan process encountered an error.' });
      addToast(err.message || 'Scan process encountered an error.', 'error');
    }
  }, [dispatch, addToast]);

  const runUrlScan = useCallback(async (url) => {
    dispatch({ type: ACTIONS.SET_SCAN_STATUS, payload: 'scanning' });
    dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: 5 });
    dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: 'Initializing URL threat assessment...' });

    try {
      const { data, isMock } = await scanUrl(url);
      
      // If it is mock or returned instantly (not async job)
      if (isMock || data.model_version !== "Celery-Background") {
        dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: 100 });
        dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: 'Threat analysis complete.' });
        dispatch({ type: ACTIONS.SET_MOCK_DATA, payload: isMock });
        await new Promise(r => setTimeout(r, 400));
        dispatch({ type: ACTIONS.SET_SCAN_RESULT, payload: data });
        dispatch({ type: ACTIONS.ADD_TO_HISTORY, payload: { ...data, url } });
        addToast(`URL threat analysis complete`, 'success');
        return;
      }

      const jobId = data.id;

      // ─── WebSocket Connection for URL Threat Assessment ─────────────────
      try {
        await new Promise((resolve, reject) => {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${protocol}//${import.meta.env.VITE_WS_URL || 'localhost:8000/api/v1/ws'}/scans/${jobId}`;
          const socket = new WebSocket(wsUrl);
          let hasEnded = false;

          socket.onmessage = (event) => {
            try {
              const statusUpdate = JSON.parse(event.data);
              const jobStatus = statusUpdate.status;
              
              if (statusUpdate.progress) {
                dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: statusUpdate.progress });
              }
              if (statusUpdate.message) {
                dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: statusUpdate.message });
              }

              if (jobStatus === "SUCCESS" && statusUpdate.result) {
                hasEnded = true;
                const finalResult = statusUpdate.result;
                dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: 100 });
                dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: 'Threat assessment complete.' });
                setTimeout(() => {
                  dispatch({ type: ACTIONS.SET_SCAN_RESULT, payload: finalResult });
                  dispatch({ type: ACTIONS.ADD_TO_HISTORY, payload: { ...finalResult, url } });
                  addToast(`URL threat assessment successful`, 'success');
                  socket.close();
                  resolve();
                }, 400);
              } else if (jobStatus === "FAILED" || jobStatus === "FAILURE") {
                hasEnded = true;
                socket.close();
                reject(new Error(statusUpdate.message || "Background verification task failed."));
              }
            } catch (err) {
              console.error("WS payload parse error:", err);
            }
          };

          socket.onerror = (err) => {
            if (!hasEnded) {
              socket.close();
              reject(new Error("WebSocket connection error."));
            }
          };

          socket.onclose = () => {
            if (!hasEnded) {
              reject(new Error("WebSocket closed unexpectedly."));
            }
          };
        });
      } catch (wsError) {
        console.warn("WebSocket failed, falling back to polling...", wsError);

        // ─── Fallback HTTP Polling ──────────────────────────────────────────
        let jobStatus = "PENDING";
        let retries = 0;
        const maxRetries = 100;

        while (jobStatus === "PENDING" || jobStatus === "PROCESSING") {
          await new Promise(r => setTimeout(r, 2000));
          const statusUpdate = await getScanJobStatus(jobId);
          jobStatus = statusUpdate.status || "PENDING";
          
          if (statusUpdate.progress) {
            dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: statusUpdate.progress });
          }
          if (statusUpdate.message) {
            dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: statusUpdate.message });
          }

          if (jobStatus === "SUCCESS" && statusUpdate.result) {
            const finalResult = statusUpdate.result;
            dispatch({ type: ACTIONS.SET_SCAN_PROGRESS, payload: 100 });
            dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: 'Threat analysis successful.' });
            await new Promise(r => setTimeout(r, 400));
            dispatch({ type: ACTIONS.SET_SCAN_RESULT, payload: finalResult });
            dispatch({ type: ACTIONS.ADD_TO_HISTORY, payload: { ...finalResult, url } });
            addToast(`URL threat assessment successful`, 'success');
            return;
          } else if (jobStatus === "FAILURE") {
            throw new Error(statusUpdate.error || "Background URL verification failed.");
          }
        }
      }

    } catch (err) {
      console.error("URL scan failed:", err);
      dispatch({ type: ACTIONS.SET_SCAN_STATUS, payload: 'error' });
      dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: err.message || 'Threat scan encountered an error.' });
      addToast(err.message || 'URL threat scan failed.', 'error');
    }
  }, [dispatch, addToast]);

  return { runScan, runUrlScan };
}
