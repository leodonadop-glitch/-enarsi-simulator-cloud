import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

function getRelativeTimeString(lastSeenIso) {
  if (!lastSeenIso) return 'Inactivo';
  const lastSeen = new Date(lastSeenIso);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  
  if (diffMins < 5) return 'Online';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? 'Hace 1 hora' : `Hace ${diffHours} horas`;
  }
  
  // Check calendar yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');
  const lastSeenStr = lastSeen.toLocaleDateString('en-CA');
  
  if (lastSeenStr === yesterdayStr) return 'Ayer';
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return diffDays === 1 ? 'Hace 1 dia' : `Hace ${diffDays} dias`;
  }
  
  return 'Inactivo';
}

function OnlineStatus({ user }) {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const lastFetchedRef = useRef(0);

  const fetchOnlineUsers = useCallback(async (force = false) => {
    const now = Date.now();
    // Cache: prevent refetching if last query was less than 25 seconds ago (unless forced)
    if (!force && now - lastFetchedRef.current < 25000) {
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, display_name, last_seen_at')
        .neq('id', user.id)
        .order('last_seen_at', { ascending: false });

      if (fetchError) throw fetchError;

      setUsersList(data || []);
      setError(false);
      lastFetchedRef.current = Date.now();
    } catch (err) {
      console.error('Error fetching online companions:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    // Initial fetch
    fetchOnlineUsers(true);

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchOnlineUsers();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchOnlineUsers]);

  if (loading) {
    return (
      <div className="session-card glass-panel online-users-card">
        <h2 className="session-card-title">👥 Companeros en Linea</h2>
        <p className="text-muted">Cargando compañeros...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session-card glass-panel online-users-card">
        <h2 className="session-card-title">👥 Companeros en Linea</h2>
        <p className="text-muted" style={{ color: 'var(--danger)' }}>
          Error al cargar compañeros.
        </p>
      </div>
    );
  }

  return (
    <div className="session-card glass-panel online-users-card">
      <h2 className="session-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>👥 Companeros en Linea</span>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => fetchOnlineUsers(true)}
          style={{ fontSize: '0.65rem', padding: '3px 8px' }}
        >
          Refrescar
        </button>
      </h2>

      {usersList.length === 0 ? (
        <p className="text-muted">No hay otros compañeros registrados.</p>
      ) : (
        <div className="online-users-list">
          {usersList.map((companion) => {
            const timeStr = getRelativeTimeString(companion.last_seen_at);
            const isOnline = timeStr === 'Online';
            
            return (
              <div key={companion.id} className="companion-item-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                  <span className="companion-name">{companion.display_name}</span>
                </div>
                <span className={`companion-time ${isOnline ? 'online-text' : 'offline-text'}`}>
                  {timeStr}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OnlineStatus;
