import assert from 'node:assert/strict';

import {
  DEFAULT_NEW_USER,
  hasUnsavedSettingsChanges,
  isSchoolSettingsDirty,
  isUserFormDirty,
} from '../src/components/settingsModalState.mjs';

const savedSchool = {
  schoolName: 'Sunrise Primary',
  schoolAddress: '12 Main Street',
  schoolPhone: '555-0100',
  schoolEmail: 'info@sunrise.edu',
  voidKey: '1234',
  schoolFeesTerms: 'Fees due by the 5th',
  enableSubgrades: true,
  schoolLogo: 'logo-data',
};

assert.equal(
  isSchoolSettingsDirty(
    {
      schoolName: 'Sunrise Primary',
      schoolAddress: '12 Main Street',
      schoolPhone: '555-0100',
      schoolEmail: 'info@sunrise.edu',
      voidKey: '1234',
      schoolFeesTerms: 'Fees due by the 5th',
      enableSubgrades: true,
      schoolLogo: 'logo-data',
    },
    savedSchool
  ),
  false
);

assert.equal(
  isSchoolSettingsDirty(
    {
      ...savedSchool,
      schoolAddress: '14 Main Street',
    },
    savedSchool
  ),
  true
);

assert.equal(isUserFormDirty(DEFAULT_NEW_USER, DEFAULT_NEW_USER), false);

assert.equal(
  isUserFormDirty(
    {
      ...DEFAULT_NEW_USER,
      full_name: 'Amina Patel',
      username: 'apatel',
    },
    DEFAULT_NEW_USER
  ),
  true
);

assert.equal(
  hasUnsavedSettingsChanges({
    school: {
      current: savedSchool,
      saved: savedSchool,
    },
    profile: {
      editableFullName: 'Nandi Mokoena',
      savedFullName: 'Nandi Mokoena',
      password: '',
      newPassword: '',
      confirmPassword: '',
    },
    userForm: {
      current: DEFAULT_NEW_USER,
      baseline: DEFAULT_NEW_USER,
      isOpen: false,
    },
    isSavingAny: false,
    hasLoadedSettings: true,
    hasLoadedProfile: true,
  }),
  false
);

assert.equal(
  hasUnsavedSettingsChanges({
    school: {
      current: savedSchool,
      saved: savedSchool,
    },
    profile: {
      editableFullName: 'Nandi Mokoena',
      savedFullName: 'Nandi Mokoena',
      password: '',
      newPassword: '',
      confirmPassword: '',
    },
    userForm: {
      current: {
        ...DEFAULT_NEW_USER,
        username: 'newuser',
      },
      baseline: DEFAULT_NEW_USER,
      isOpen: true,
    },
    isSavingAny: false,
    hasLoadedSettings: true,
    hasLoadedProfile: true,
  }),
  true
);

console.log('settings-modal dirty-state checks passed');
