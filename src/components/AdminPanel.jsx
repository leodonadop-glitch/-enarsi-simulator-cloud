import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function AdminPanel({ profile, onBack }) {
  const [activeTab, setActiveTab] = useState('whitelist');
  const [whitelist, setWhitelist] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [logFilter, setLogFilter] = useState('7d'); // '24h', '7d', '30d', 'all'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (profile?.is_admin) {
      fetchWhitelist();
      fetchLogs();
    }
  }, [profile, logFilter]);

  const fetchWhitelist = async () => {
    try {
      const { data, error } = await supabase
        .from('whitelist_emails')
        .select(`
          id,
          email,
          is_active,
          created_at,
          added_by,
          profiles:added_by (
            display_name
          )
        `)
        .order('email', { ascending: true });

      if (error) throw error;
      setWhitelist(data || []);
    } catch (err) {
      console.error('Error fetching whitelist:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('access_logs')
        .select('*')
        .order('created_at', { ascending: false });

      const now = new Date();
      if (logFilter === '24h') {
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', past24h);
      } else if (logFilter === '7d') {
        const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', past7d);
      } else if (logFilter === '30d') {
        const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', past30d);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching access logs:', err);
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const emailToAdd = newEmail.trim().toLowerCase();
    if (!emailToAdd) {
      setError('Por favor, ingresa un correo válido.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('whitelist_emails')
        .insert({
          email: emailToAdd,
          added_by: profile.id
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este correo ya está en la lista de acceso.');
        }
        throw error;
      }

      setSuccess(`¡Correo ${emailToAdd} agregado exitosamente!`);
      setNewEmail('');
      fetchWhitelist();
    } catch (err) {
      setError(err.message || 'Error al agregar correo.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('whitelist_emails')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchWhitelist();
    } catch (err) {
      console.error('Error toggling active status:', err);
    }
  };

  const handleDeleteEmail = async (id, email) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${email} de la lista de acceso?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('whitelist_emails')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchWhitelist();
    } catch (err) {
      console.error('Error deleting email:', err);
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="admin-container">
        <div className="glass-panel text-center" style={{ padding: '40px' }}>
          <h2 className="text-error">Acceso Denegado</h2>
          <p>No tienes permisos para ver esta sección.</p>
          <button className="btn btn-primary" onClick={onBack}>Volver al Simulador</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="admin-header-title">
          <h1>🛠️ Panel de Administración</h1>
          <p className="admin-subtitle">Gestión de acceso y registros de auditoría</p>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>← Volver</button>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'whitelist' ? 'active' : ''}`}
          onClick={() => setActiveTab('whitelist')}
        >
          📧 Lista de Acceso
        </button>
        <button
          className={`admin-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 Logs de Auditoría
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'whitelist' && (
          <div className="admin-card glass-panel">
            <h3>Agregar Nuevo Correo Autorizado</h3>
            <form onSubmit={handleAddEmail} className="admin-form-inline">
              <input
                type="email"
                className="form-input inline-input"
                placeholder="ejemplo@correo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Agregando...' : '➕ Agregar'}
              </button>
            </form>

            {error && <div className="auth-error mt-10">{error}</div>}
            {success && <div className="auth-success mt-10">{success}</div>}

            <h3 className="mt-30">Usuarios Autorizados ({whitelist.length})</h3>
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Correo</th>
                    <th>Estado</th>
                    <th>Agregado Por</th>
                    <th>Fecha</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {whitelist.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted">No hay correos registrados.</td>
                    </tr>
                  ) : (
                    whitelist.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.email}</strong></td>
                        <td>
                          <button
                            onClick={() => handleToggleActive(item.id, item.is_active)}
                            className={`badge ${item.is_active ? 'badge-active' : 'badge-inactive'}`}
                            title="Haz clic para cambiar estado"
                          >
                            {item.is_active ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td>{item.profiles?.display_name || 'Sistema'}</td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td className="text-center">
                          <button
                            onClick={() => handleDeleteEmail(item.id, item.email)}
                            className="btn-action-delete"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="admin-card glass-panel">
            <div className="logs-header-actions">
              <h3>Intentos de Acceso y Logs</h3>
              <div className="logs-filter-group">
                <label htmlFor="log-filter-select">Filtrar por fecha: </label>
                <select
                  id="log-filter-select"
                  className="form-input inline-select"
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                >
                  <option value="24h">Últimas 24 horas</option>
                  <option value="7d">Últimos 7 días</option>
                  <option value="30d">Últimos 30 días</option>
                  <option value="all">Todos los registros</option>
                </select>
              </div>
            </div>

            <div className="table-responsive mt-20">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Correo</th>
                    <th>Acción</th>
                    <th>Resultado</th>
                    <th>Detalles / Razón</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted">No hay logs en el período seleccionado.</td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const dateObj = new Date(log.created_at);
                      const formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      
                      let actionText = log.action;
                      if (log.action === 'signup_attempt') actionText = '📝 Registro';
                      else if (log.action === 'login_attempt') actionText = '🔑 Iniciar Sesión';
                      else if (log.action === 'code_verified') actionText = '✅ Código Correcto';
                      else if (log.action === 'code_failed') actionText = '❌ Código Erróneo';
                      else if (log.action === 'email_unconfirmed') actionText = '✉️ Email Sin Confirmar';

                      return (
                        <tr key={log.id}>
                          <td><span className="text-muted">{formattedDate}</span></td>
                          <td><strong>{log.email}</strong></td>
                          <td>{actionText}</td>
                          <td>
                            <span className={`badge ${log.success ? 'badge-success' : 'badge-error'}`}>
                              {log.success ? 'Éxito' : 'Fallo'}
                            </span>
                          </td>
                          <td><span className="text-muted">{log.reason || '-'}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
