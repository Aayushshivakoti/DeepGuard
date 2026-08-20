import { useCallback } from 'react';
import { useApp, ACTIONS } from '../context/AppContext';
import { scanFile, scanUrl, getScanJobStatus } from '../api/scanApi';
import { useToast } from '../context/ToastContext';

const SCAN_STEPS = {
  image: [
    'Parsing image metadata...',
    'Extracting facial landmarks...',
    'Running Spatial FFT analysis...',
    'Applying GAN fingerprint detector...',
    'Computing Grad-CAM heatmap...',
    'Cross-referencing EXIF database...',
    'Generating forensic report...',
  ],
  video: [
    'Extracting video frames...',
    'Analyzing temporal consistency...',
    'Detecting facial blending artifacts...',
    'Running optical flow analysis...',
    'Checking audio-visual sync...',
    'Computing spectral anomaly score...',
    'Generating forensic report...',
  ],
  audio: [
    'Parsing audio waveform...',
    'Computing Mel-spectrogram...',
    'Detecting voice clone markers...',
    'Analyzing prosody patterns...',
    'Running LFCC feature extraction...',
    'Comparing vocal tract model...',
    'Generating forensic report...',
  ],
  pdf: [
    'Extracting document structure...',
    'Scanning embedded metadata...',
    'Checking digital signatures...',
    'Detecting hidden layers...',
    'Analyzing font anomalies...',
    'Running OCR consistency check...',
    'Generating forensic report...',
  ],
  url: [
    'Resolving domain DNS...',
    'Checking SSL certificate...',
    'Scanning domain registration...',
    'Running Google Safe Browsing check...',
    'Analyzing URL pattern matching...',
    'Computing phishing probability...',
    'Generating threat report...',
  ],
};

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

      // If it is a Celery background job, begin polling
      const jobId = data.id;
      let jobStatus = "PENDING";
      let retries = 0;
      const maxRetries = 100;

      while (jobStatus === "PENDING" || jobStatus === "PROCESSING") {
        await new Promise(r => setTimeout(r, 1500));
        try {
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
        } catch (pollErr) {
          console.warn("Polling status error:", pollErr);
          retries++;
          if (retries > maxRetries) {
            throw new Error("Polling timeout exceeded.");
          }
        }
      }
    } catch (err) {
      console.error("Scan failed:", err);
      dispatch({ type: ACTIONS.SET_SCAN_STATUS, payload: 'error' });
      dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: err.message || 'Scan process encountered an error.' });
      addToast(err.message || 'Scan process encountered an error.', 'error');
    }
  }, [dispatch]);

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

      // If it is a Celery background job, begin polling
      const jobId = data.id;
      let jobStatus = "PENDING";
      let retries = 0;
      const maxRetries = 100;

      while (jobStatus === "PENDING" || jobStatus === "PROCESSING") {
        await new Promise(r => setTimeout(r, 1500));
        try {
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
        } catch (pollErr) {
          console.warn("Polling URL status error:", pollErr);
          retries++;
          if (retries > maxRetries) {
            throw new Error("Polling timeout exceeded.");
          }
        }
      }
    } catch (err) {
      console.error("URL scan failed:", err);
      dispatch({ type: ACTIONS.SET_SCAN_STATUS, payload: 'error' });
      dispatch({ type: ACTIONS.SET_SCAN_STEP, payload: err.message || 'Threat scan encountered an error.' });
      addToast(err.message || 'URL threat scan failed.', 'error');
    }
  }, [dispatch]);

  return { runScan, runUrlScan };
}
