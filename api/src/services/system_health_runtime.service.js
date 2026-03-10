let databaseEmergencyState = {
  deactivated: false,
  deactivatedAt: null,
  deactivatedBy: null,
};

export function isDatabaseEmergencyDeactivated() {
  return Boolean(databaseEmergencyState.deactivated);
}

export function setDatabaseEmergencyDeactivated({ deactivated, actorUserId = null } = {}) {
  if (deactivated) {
    databaseEmergencyState = {
      deactivated: true,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: actorUserId || null,
    };
    return databaseEmergencyState;
  }
  databaseEmergencyState = {
    deactivated: false,
    deactivatedAt: null,
    deactivatedBy: null,
  };
  return databaseEmergencyState;
}

export function getDatabaseEmergencyState() {
  return { ...databaseEmergencyState };
}
