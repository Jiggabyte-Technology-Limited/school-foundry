export const DEFAULT_NEW_USER = Object.freeze({
  id: null,
  full_name: '',
  username: '',
  password: '',
  confirmPassword: '',
  role: 'user',
});

const SCHOOL_FIELDS = [
  'schoolName',
  'schoolAddress',
  'schoolPhone',
  'schoolEmail',
  'voidKey',
  'schoolFeesTerms',
  'enableSubgrades',
  'schoolLogo',
];

const USER_FIELDS = ['id', 'full_name', 'username', 'password', 'confirmPassword', 'role'];

export function isSchoolSettingsDirty(current, saved) {
  if (!saved) return false;
  return SCHOOL_FIELDS.some(field => current[field] !== saved[field]);
}

export function isProfileDirty(profile) {
  return (
    profile.editableFullName !== profile.savedFullName ||
    profile.password !== '' ||
    profile.newPassword !== '' ||
    profile.confirmPassword !== ''
  );
}

export function isUserFormDirty(current, baseline = DEFAULT_NEW_USER) {
  return USER_FIELDS.some(field => current[field] !== baseline[field]);
}

export function hasUnsavedSettingsChanges({
  school,
  profile,
  userForm,
  isSavingAny,
  hasLoadedSettings,
  hasLoadedProfile,
}) {
  if (isSavingAny) return false;

  return (
    (hasLoadedSettings && isSchoolSettingsDirty(school.current, school.saved)) ||
    (hasLoadedProfile && isProfileDirty(profile)) ||
    (userForm.isOpen && isUserFormDirty(userForm.current, userForm.baseline))
  );
}
