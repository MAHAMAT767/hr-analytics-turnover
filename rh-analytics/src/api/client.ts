// src/api/client.ts
// ✅ MODIFICATION : ajout de `explain` (POST /api/explain) manquant
// Toutes les autres fonctions sont conservées à l'identique.

import axios from 'axios';

export const API = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
});

export const getStats      = ()          => API.get('/api/stats');
export const predict       = (data: any) => API.post('/api/predict', data);
export const explain       = (data: any) => API.post('/api/explain', data); // ← AJOUT
export const survival      = (data: any) => API.post('/api/survival', data); // ← AJOUT
export const chatMessage   = (data: any) => API.post('/api/chat', data);
export const getDataset    = ()          => API.get('/api/dataset');
export const getFeatureImp = ()          => API.get('/api/feature-importance');
export const getModelInfo  = ()          => API.get('/api/model-info');
export const getMetrics    = ()          => API.get('/api/metrics');
export const getMonitoring = ()          => API.get('/api/monitoring');
export const getDrift      = ()          => API.get('/api/drift');
export const getMlflowSummary = ()             => API.get('/api/mlflow/summary');
export const getMlflowRun     = (runId: string) => API.get(`/api/mlflow/runs/${runId}`);