import path from 'node:path';

const CLEAR_DATABASE = 'CLEAR DATABASE';
const RESET_APP = 'RESET APP';

export function getDangerZoneConfirmationPhrase(action) {
  return action === 'reset-app' ? RESET_APP : CLEAR_DATABASE;
}

export function getClearDatabaseTargets(userDataPath) {
  return [path.join(userDataPath, 'data.db')];
}

export function getResetAppTargets(userDataPath) {
  return [
    path.join(userDataPath, 'data.db'),
    path.join(userDataPath, 'license.lic'),
    path.join(userDataPath, 'print-output'),
  ];
}
