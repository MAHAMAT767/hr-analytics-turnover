import { useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────

export interface NetworkEvent {
  id:     number;
  type:   'danger' | 'warning' | 'info';
  titre:  string;
  desc:   string;
  time:   string;
  lu:     boolean;
}

export interface NetworkStatus {
  gateway:    string;
  online:     boolean;
  latency_ms: number | null;
  last_check: string;
}

interface WsPayload {
  status: NetworkStatus;
  events: Omit<NetworkEvent, 'id' | 'lu'>[];
}

// ── Hook ──────────────────────────────────────────────────────────────

let _eventIdCounter = 1000; // commence à 1000 pour ne pas collisionner avec les notifs statiques

interface UseNetworkMonitorOptions {
  onEvents:       (events: NetworkEvent[]) => void;
  onStatusUpdate: (status: NetworkStatus) => void;
  wsUrl?:         string;
}

export function useNetworkMonitor({
  onEvents,
  onStatusUpdate,
  wsUrl = 'ws://localhost:8000/ws/network',
}: UseNetworkMonitorOptions) {
  const wsRef           = useRef<WebSocket | null>(null);
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef      = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Connexion établie — pas de notification, c'est silencieux
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const payload: WsPayload = JSON.parse(evt.data);

        // Mise à jour du statut réseau
        onStatusUpdate(payload.status);

        // Conversion des événements bruts en notifications enrichies
        if (payload.events && payload.events.length > 0) {
          const enriched: NetworkEvent[] = payload.events.map((e) => ({
            ...e,
            id:  _eventIdCounter++,
            lu:  false,
          }));
          onEvents(enriched);
        }
      } catch {
        // payload malformé — on ignore silencieusement
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      // Reconnexion automatique après 5 secondes
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws.close(); // déclenche onclose → reconnexion
    };
  }, [wsUrl, onEvents, onStatusUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);
}