// ============================================================================
// SYNC (09-sync.js)
// Cloud sync with merge stub (Part 6 / Milestone M9)
// ============================================================================

const syncService = {
  isConfigured() {
    return false;
  },

  getStatus() {
    return 'offline'; // 'offline' | 'syncing' | 'synced' | 'conflict' | 'error'
  }
};
