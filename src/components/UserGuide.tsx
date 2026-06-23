import React, { useEffect, useState } from 'react';
import { db } from '../lib/db-client';
import { printDocument } from '../lib/print/print-document';
import {
  buildPrintableGuideHtml,
  type PrintableGuideSection,
} from '../lib/print/user-guide';
import { useToast } from './Toast';

type GuideAudience = PrintableGuideSection['audience'];

type GuideSection = PrintableGuideSection;

type GuideMediaItem = {
  fileName: string;
  fileUrl: string;
};

type GuideMediaSection = {
  id: string;
  screenshots: GuideMediaItem[];
  videos: GuideMediaItem[];
};

type GuideMediaLibrary = {
  rootPath: string;
  sections: GuideMediaSection[];
};

const sections: GuideSection[] = [
  {
    id: 'app-tour',
    group: 'Getting Started',
    title: 'Navigate the app',
    audience: 'All users',
    summary: 'Learn where everything lives so you can move around the system quickly.',
    before: [
      'Make sure you are signed in.',
      'Keep the User Guide open in this window if you want to follow along.',
    ],
    steps: [
      'Use the left sidebar to switch between Dashboard, Class Lists, Learner Accounts, Payments, School Fees, Logs, Backup, and Settings.',
      'Read the page title at the top of the screen to confirm where you are.',
      'Use the search fields and filters on each page to narrow down the list of learners, payments, or log entries.',
      'Click a row or card when you want to open the detailed view for that learner or record.',
      'Look for action buttons in the top right of each page for print, export, add, or edit actions.',
    ],
    after: [
      'You should now know how to move between the main parts of the app.',
      'Once you are comfortable here, move to the learner and payment guides below.',
    ],
    tips: [
      'The Dashboard is the best place to start if you want a quick overview of the school day.',
      'Status badges help you spot active, inactive, owing, paid, and voided items quickly.',
    ],
  },
  {
    id: 'add-learner',
    group: 'Learners',
    title: 'Add a learner',
    audience: 'All users',
    summary: 'Create a new learner record and enroll the learner in the current academic year.',
    before: [
      'You need the learner name, date of birth if available, guardian contact details, and the grade the learner belongs in.',
      'If your school uses class sections, know which section should be selected.',
    ],
    steps: [
      'Open Learner Accounts or Students and click Add Learner.',
      'Type the learner’s full name, date of birth, and gender on the first step.',
      'Enter the primary guardian name and contact details on the next step.',
      'If needed, fill in the second guardian fields and email address.',
      'Choose the learner’s grade and, if available, the correct class section.',
      'Review the confirmation page carefully before saving.',
      'Click Finish or Add Learner to save the record.',
    ],
    after: [
      'The learner will appear in the learner list once saved.',
      'If the school uses fees, the system can begin tracking the learner’s balance right away.',
    ],
    tips: [
      'Use the learner search field later to confirm the new record saved correctly.',
      'Double-check the guardian contact number before saving because that is often the fastest way to reach the family.',
    ],
  },
  {
    id: 'edit-learner',
    group: 'Learners',
    title: 'Edit a learner',
    audience: 'All users',
    summary: 'Update learner or guardian details when something changes.',
    before: [
      'Open the learner’s record first from Learner Accounts, Class Lists, Dashboard, or the learner list.',
    ],
    steps: [
      'Click the learner you want to update.',
      'Choose Edit from the learner detail panel or the learner card.',
      'Update the name, date of birth, gender, guardian name, guardian contact, or email as needed.',
      'If the learner moved grades or sections, update the enrollment details too.',
      'Review the changes before saving.',
      'Click Save Changes.',
    ],
    after: [
      'The updated details should appear immediately after saving.',
      'Any later statements or receipts will use the updated learner information.',
    ],
    tips: [
      'If you only need to change one field, still review the whole form before saving.',
      'Changing the grade or section can affect where the learner appears in class lists.',
    ],
  },
  {
    id: 'activate-deactivate',
    group: 'Learners',
    title: 'Activate or deactivate a learner',
    audience: 'Admin only',
    summary: 'Mark a learner as active when they are in school or inactive when they leave.',
    before: [
      'Open the learner profile.',
    ],
    steps: [
      'Select the learner from the list.',
      'Use the Active or Inactive action in the learner detail panel.',
      'Confirm the change when prompted.',
      'Check the status badge to confirm the update.',
    ],
    after: [
      'Inactive learners will no longer appear in the normal active list.',
      'You can reactivate them later if they return.',
    ],
    tips: [
      'Deactivate a learner instead of deleting them if you still need their history.',
      'This keeps payment and academic records intact.',
    ],
    warnings: [
      'Do not deactivate a learner if the account still needs payment or report follow-up without first checking the school policy.',
    ],
  },
  {
    id: 'open-account',
    group: 'Payments',
    title: 'Open a learner account',
    audience: 'All users',
    summary: 'View the learner’s balance, statement, and payment history.',
    before: [
      'Find the learner from the Dashboard, Learner Accounts, Class Lists, or Payments page.',
    ],
    steps: [
      'Click the learner name or the View Statement action.',
      'Wait for the statement panel to load the learner’s fees and payments.',
      'Review the balance at the top of the page.',
      'Scroll through the history to see fees, payments, and receipt references.',
    ],
    after: [
      'You should now understand whether the learner is owing, paid, or partially paid.',
      'From here you can print, export, or record another payment.',
    ],
    tips: [
      'Use this view when you need a full financial history for one learner.',
      'The statement view is often the fastest place to jump into a payment or receipt task.',
    ],
  },
  {
    id: 'record-payment',
    group: 'Payments',
    title: 'Record a payment',
    audience: 'All users',
    summary: 'Enter a payment, choose the method, and save the receipt.',
    before: [
      'Know which learner is paying, the amount received, and the payment method used.',
      'If possible, confirm the correct academic year first.',
    ],
    steps: [
      'Open the Payments page.',
      'Search for the learner and select them from the list.',
      'Enter the amount received.',
      'Choose the payment method, such as cash or card.',
      'Add notes if needed.',
      'Check the preview or confirmation screen for the receipt number, learner name, and amount.',
      'Click Confirm Payment to save.',
    ],
    after: [
      'The receipt preview opens after the payment is recorded.',
      'The learner balance and recent activity should update right away.',
    ],
    tips: [
      'Always confirm the amount before saving because receipts are usually hard to change later.',
      'If the payment looks wrong, stop and fix it before confirming.',
    ],
  },
  {
    id: 'void-payment',
    group: 'Payments',
    title: 'Void a payment and review the receipt',
    audience: 'Admin only',
    summary: 'Reverse a payment when it was entered incorrectly or must be cancelled.',
    before: [
      'Open the payment receipt or payment record that needs to be voided.',
      'Make sure you are certain the payment should be reversed.',
    ],
    steps: [
      'Open the receipt or payment detail view.',
      'Choose Void.',
      'Enter the reason for voiding the payment.',
      'Add a comment if more explanation is needed.',
      'Confirm the action.',
      'Check the learner balance and activity log after voiding.',
    ],
    after: [
      'The voided payment should be marked clearly in the system.',
      'The learner’s outstanding balance will update if the payment was affecting it.',
    ],
    tips: [
      'Use the void reason field to keep a clear audit trail.',
      'Void rather than delete so the school still has a record of what happened.',
    ],
    warnings: [
      'Void actions are destructive to the financial record, so confirm the receipt number and learner before proceeding.',
    ],
  },
  {
    id: 'statements-export',
    group: 'Payments',
    title: 'Print or export a statement',
    audience: 'All users',
    summary: 'Create a printable statement or Excel file for a learner or a payment list.',
    before: [
      'Open the learner statement or the payment activity report.',
    ],
    steps: [
      'Open the learner account or payment report you want to print.',
      'Choose Print Statement or Export Excel.',
      'Wait for the file dialog to appear.',
      'Choose a file name and save location.',
      'Open the saved file in Excel or your PDF viewer to check that it looks correct.',
    ],
    after: [
      'You should now have a saved file you can share or print later.',
      'Excel exports can be edited or filtered outside the app if needed.',
    ],
    tips: [
      'Use Excel when you need to sort or analyse the data later.',
      'Use print/PDF when you want a locked presentation copy.',
    ],
  },
  {
    id: 'class-list',
    group: 'Reports',
    title: 'Use class lists',
    audience: 'All users',
    summary: 'Review learners by class, print a register, or export the list.',
    before: [
      'Choose the class list you want to work with.',
    ],
    steps: [
      'Open Class Lists from the sidebar.',
      'Select the class, grade, or section you want to view.',
      'Use the list to check who is in the class.',
      'Click a learner name if you need to jump into their account.',
      'Choose Print Class List or Export Excel when you need a saved copy.',
    ],
    after: [
      'The class list can be used as a register or attendance reference.',
      'Excel exports are useful when the school wants to update a register by hand.',
    ],
    tips: [
      'This view is useful at the start of the term for checking enrollments.',
    ],
  },
  {
    id: 'school-fees',
    group: 'Admin',
    title: 'Set school fees',
    audience: 'Admin only',
    summary: 'Define how much each grade owes for each payment period.',
    before: [
      'Make sure the academic year, grades, and payment periods already exist.',
    ],
    steps: [
      'Open School Fees from the sidebar.',
      'Choose the academic year you want to edit.',
      'Find the grade and payment period cell you want to update.',
      'Type the amount for that grade and period.',
      'Click the cell or save button to store the change.',
      'Use Save All if you have made several edits and want to commit them together.',
      'Print or export the fee table when you want a shareable record.',
    ],
    after: [
      'The fee structure will be used when learner balances and statements are calculated.',
      'Payments recorded later will compare against these fees.',
    ],
    tips: [
      'If every period should cost the same amount, use the copy-across option to save time.',
    ],
    warnings: [
      'Changing fees affects learner balances, so double-check the year and grade before saving.',
    ],
  },
  {
    id: 'backup-restore',
    group: 'Admin',
    title: 'Back up or restore the database',
    audience: 'Admin only',
    summary: 'Protect the school data and recover it when needed.',
    before: [
      'Create a backup before major changes, upgrades, or maintenance work.',
    ],
    steps: [
      'Open Backup from the sidebar.',
      'Choose Create Backup to save a copy of the database file.',
      'Store the backup in a safe location.',
      'If you need to recover data later, choose Restore from Backup and select the backup file.',
      'Restart the app after a restore so the restored data loads correctly.',
    ],
    after: [
      'The backup file can be kept as a safety copy.',
      'After restore, the app should reopen with the recovered data.',
    ],
    tips: [
      'Keep more than one backup if the school updates data often.',
    ],
    warnings: [
      'Restoring a backup replaces the current database, so only do this when you are sure.',
    ],
  },
  {
    id: 'settings-admin',
    group: 'Admin',
    title: 'Settings, users, license, and danger zone',
    audience: 'Admin only',
    summary: 'Manage branding, access, license status, and maintenance tools.',
    before: [
      'Open Settings from the sidebar.',
    ],
    steps: [
      'Update school name, logo, phone number, email, and print header information in the School tab.',
      'Use the Users tab to add, edit, activate, or deactivate staff accounts.',
      'Check the License tab to confirm the app is activated correctly.',
      'Review the Danger Zone only when you need a maintenance action such as clearing the database or resetting the app.',
    ],
    after: [
      'The school branding will appear on statements, receipts, and exports.',
      'User permissions will affect what each person can see or change in the app.',
    ],
    tips: [
      'Keep the school name and contact details consistent across all reports.',
      'Use the danger actions only after confirming backups and policy.',
    ],
    warnings: [
      'Reset App removes school data, user data, and license information and returns the app to first-run state.',
      'Clear Database removes the current data store, so confirm the action before proceeding.',
    ],
  },
  {
    id: 'first-run',
    group: 'Admin',
    title: 'First-time setup',
    audience: 'Admin only',
    summary: 'Prepare the school in the app before staff start using it.',
    before: [
      'Have the school name, logo, admin account details, grades, and term dates ready.',
    ],
    steps: [
      'Complete the first-run setup wizard.',
      'Create the first admin user.',
      'Enter the school details and branding.',
      'Set up grades, class sections, academic years, and terms.',
      'Add school fees before recording payments.',
      'Review the dashboard to confirm that the school is ready for day-to-day use.',
    ],
    after: [
      'Once setup is complete, staff can begin enrolling learners and recording payments.',
      'The app will now behave like a normal school management system instead of a fresh install.',
    ],
    tips: [
      'Do the setup in the same order every time: school details first, then grades, terms, and fees.',
    ],
  },
];

const groupOrder: GuideSection['group'][] = ['Getting Started', 'Learners', 'Payments', 'Reports', 'Admin'];

const groupTitles: Record<GuideSection['group'], string> = {
  'Getting Started': 'Getting Started',
  Learners: 'Learners',
  Payments: 'Payments',
  Reports: 'Reports and Exports',
  Admin: 'Admin Tools',
};

const UserGuide: React.FC = () => {
  const { showToast } = useToast();
  useEffect(() => {
    document.title = 'SchoolFoundry User Guide';
  }, []);

  const [mediaLibrary, setMediaLibrary] = useState<GuideMediaLibrary | null>(null);

  // Live school name for print + on-screen header. Always reads from
  // app_settings so it stays correct after a database import/restore.
  const [schoolName, setSchoolName] = useState<string>('');
  const [schoolNameMissing, setSchoolNameMissing] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const fetchSchoolName = async (): Promise<{ value: string; missing: boolean }> => {
    try {
      const setting = await db.get("SELECT value FROM app_settings WHERE key = 'school_name'");
      const value = setting?.value?.toString()?.trim() ?? '';
      return { value, missing: value.length === 0 };
    } catch (err) {
      console.error('Failed to load school name for user guide:', err);
      return { value: '', missing: true };
    }
  };

  useEffect(() => {
    fetchSchoolName().then(({ value, missing }) => {
      setSchoolName(value);
      setSchoolNameMissing(missing);
    });
  }, []);

  const handlePrintGuide = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      // Re-fetch at print time so the latest DB value is always used.
      const fresh = await fetchSchoolName();
      setSchoolName(fresh.value);
      setSchoolNameMissing(fresh.missing);

      const html = buildPrintableGuideHtml({
        schoolName: fresh.value,
        generatedAt: new Date().toLocaleString(),
        sections: sections as PrintableGuideSection[],
        groupTitles: groupTitles as Record<string, string>,
        printOnly: true,
      });
      const safeName = (fresh.value || 'schoolfoundry')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const filename = `${safeName || 'schoolfoundry'}-user-guide.pdf`;
      const titleSuffix = fresh.value ? ` — ${fresh.value}` : '';
      const filePath = await printDocument({
        html,
        filename,
        title: `SchoolFoundry User Guide${titleSuffix}`,
      });
      if (filePath) {
        showToast('success', 'User Guide Printed', `Saved to ${filePath}`);
      } else {
        showToast('error', 'Print Failed', 'Could not generate the PDF. Check the print output folder.');
      }
      if (fresh.missing) {
        showToast(
          'info',
          'School name not set',
          'Open Settings → School Details to set the school name so it shows on the next print.'
        );
      }
    } catch (err: any) {
      console.error('User guide print failed:', err);
      showToast('error', 'Print Failed', err?.message || 'Unexpected error while printing the guide.');
    } finally {
      setIsPrinting(false);
    }
  };


  useEffect(() => {
    let mounted = true;

    const loadMediaLibrary = async () => {
      try {
        const result = await window.api.getGuideMediaLibrary();
        if (!mounted || !result.success) return;

        setMediaLibrary({
          rootPath: result.rootPath || '',
          sections:
            result.sections?.map(section => ({
              id: section.id,
              screenshots: section.screenshots || [],
              videos: section.videos || [],
            })) || [],
        });
      } catch (err) {
        console.error('Failed to load guide media library:', err);
      }
    };

    loadMediaLibrary();

    return () => {
      mounted = false;
    };
  }, []);

  const groupedSections = groupOrder.map(group => ({
    group,
    sections: sections.filter(section => section.group === group),
  }));

  const getSectionMedia = (sectionId: string) =>
    mediaLibrary?.sections.find(section => section.id === sectionId) || {
      id: sectionId,
      screenshots: [],
      videos: [],
    };

  return (
    <div
      id="top"
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(249,115,22,0.12), transparent 28%), linear-gradient(180deg, #fbf7f2 0%, #ffffff 45%, #f8faf8 100%)',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px 40px' }}>
        <div
          className="card-surface"
          style={{
            marginBottom: 24,
            padding: '24px 28px',
            border: '1px solid rgba(249,115,22,0.15)',
            boxShadow: '0 20px 60px rgba(17,24,39,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <img
              src="/img/schoolfoundry-icon.png"
              alt="SchoolFoundry"
              style={{ width: 56, height: 56 }}
            />
            <div style={{ flex: 1, minWidth: 280 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(249,115,22,0.1)',
                  color: '#c2410c',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                User Guide
              </div>
              <h1 style={{ margin: '0 0 8px', fontSize: 30, lineHeight: 1.1 }}>
                How to actually do things in SchoolFoundry
              </h1>
              <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--primary)', fontWeight: 700 }}>
                {schoolName || 'SchoolFoundry'}
              </p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 900 }}>
                This guide is written as a practical handbook. Each page explains where to click,
                what to enter, what should happen next, and where a short video or GIF can be
                inserted later.
              </p>
            </div>
            <div
              style={{
                minWidth: 260,
                padding: '14px 16px',
                borderRadius: 16,
                background: '#fff',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                HOW TO USE THIS GUIDE
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: 'var(--text-primary)' }}>
                Read the steps, then watch the video slot below the instructions when you add the
                media later.
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(249,115,22,0.08)',
                  border: '1px solid rgba(249,115,22,0.18)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                Media folder: <strong>{mediaLibrary?.rootPath || 'Loading guide media folder...'}</strong>
                <br />
                Put screenshots in <code>screenshots</code> and videos in <code>videos</code> under each
                tutorial folder.
              </div>
              <button
                type="button"
                onClick={handlePrintGuide}
                disabled={isPrinting}
                title={
                  schoolNameMissing
                    ? 'Print now &mdash; school name will fall back to "SchoolFoundry" until set in Settings.'
                    : `Print this guide with the current school name: ${schoolName || 'SchoolFoundry'}`
                }
                style={{
                  marginTop: 14,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: isPrinting
                    ? 'rgba(249,115,22,0.4)'
                    : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isPrinting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.25)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                {isPrinting ? 'Saving PDF...' : 'Print / Save PDF'}
              </button>
              {schoolNameMissing && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: '#9a3412',
                    background: 'rgba(249,115,22,0.08)',
                    border: '1px solid rgba(249,115,22,0.18)',
                    padding: '6px 8px',
                    borderRadius: 8,
                    lineHeight: 1.4,
                  }}
                >
                  School name not set &mdash; showing "SchoolFoundry". Open Settings to set it.
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '300px minmax(0, 1fr)',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <aside
            className="card-surface"
            style={{
              position: 'sticky',
              top: 20,
              padding: 20,
              border: '1px solid var(--border)',
              maxHeight: 'calc(100vh - 40px)',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Contents</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {groupedSections.map(group => (
                <div key={group.group}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                      marginBottom: 8,
                    }}
                  >
                    {groupTitles[group.group]}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.sections.map(section => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '10px 12px',
                          borderRadius: 12,
                          textDecoration: 'none',
                          color: 'var(--text-primary)',
                          background: 'rgba(255,255,255,0.78)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{section.title}</span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: section.audience === 'Admin only' ? '#b91c1c' : '#0369a1',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {section.audience}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {groupedSections.map(group => (
              <div key={group.group} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: group.group === 'Getting Started' ? 0 : 8,
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: 'var(--primary)',
                    }}
                  />
                  <h2 style={{ margin: 0, fontSize: 18, letterSpacing: '-0.01em' }}>
                    {groupTitles[group.group]}
                  </h2>
                </div>

                {group.sections.map(section => (
                  <article
                    key={section.id}
                    id={section.id}
                    className="card-surface"
                    style={{
                      padding: 24,
                      border: '1px solid var(--border)',
                      scrollMarginTop: 24,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 10,
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background:
                              section.audience === 'Admin only'
                                ? 'rgba(220,38,38,0.1)'
                                : 'rgba(3,105,161,0.1)',
                            color: section.audience === 'Admin only' ? '#b91c1c' : '#0369a1',
                          }}
                        >
                          {section.audience}
                        </div>
                        <h3 style={{ margin: '0 0 8px', fontSize: 24 }}>{section.title}</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 900 }}>
                          {section.summary}
                        </p>
                      </div>
                      <a
                        href="#top"
                        style={{
                          alignSelf: 'start',
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--primary)',
                          textDecoration: 'none',
                        }}
                      >
                        Back to top
                      </a>
                    </div>

                    <div style={{ marginTop: 20, display: 'grid', gap: 18 }}>
                      <InfoBlock title="Before you start" tone="neutral" items={section.before} />
                      <InfoBlock title="Steps" tone="primary" items={section.steps} numbered />
                      <GuideMediaBlock
                        title="Screenshots and video"
                        description="Drop screenshots into the screenshots folder and a short video or GIF into the videos folder for this tutorial."
                        sectionId={section.id}
                        media={getSectionMedia(section.id)}
                      />
                      <InfoBlock title="After you finish" tone="neutral" items={section.after} />
                      <InfoBlock title="Tips" tone="soft" items={section.tips} />
                      {section.warnings && section.warnings.length > 0 && (
                        <InfoBlock
                          title="Important warnings"
                          tone="danger"
                          items={section.warnings}
                        />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </main>
        </div>
      </div>
    </div>
  );
};

function InfoBlock({
  title,
  items,
  tone,
  numbered = false,
}: {
  title: string;
  items: string[];
  tone: 'neutral' | 'primary' | 'soft' | 'danger';
  numbered?: boolean;
}) {
  const palette: Record<typeof tone, { bg: string; border: string; title: string; text: string }> =
    {
      neutral: {
        bg: 'rgba(255,255,255,0.84)',
        border: 'rgba(148,163,184,0.25)',
        title: 'var(--text-primary)',
        text: 'var(--text-primary)',
      },
      primary: {
        bg: 'rgba(249,115,22,0.06)',
        border: 'rgba(249,115,22,0.22)',
        title: '#c2410c',
        text: 'var(--text-primary)',
      },
      soft: {
        bg: 'rgba(2,132,199,0.06)',
        border: 'rgba(2,132,199,0.18)',
        title: '#0369a1',
        text: 'var(--text-primary)',
      },
      danger: {
        bg: 'rgba(220,38,38,0.06)',
        border: 'rgba(220,38,38,0.22)',
        title: '#b91c1c',
        text: '#7f1d1d',
      },
    };

  const style = palette[tone];

  return (
    <section
      style={{
        borderRadius: 18,
        padding: 18,
        background: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: style.title, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item, index) => (
          <div key={item} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                minWidth: 24,
                height: 24,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: numbered ? 'var(--primary)' : 'rgba(15,23,42,0.08)',
                color: numbered ? '#fff' : style.title,
                fontSize: 12,
                fontWeight: 800,
                marginTop: 1,
              }}
            >
              {numbered ? index + 1 : '•'}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: style.text }}>{item}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function GuideMediaBlock({
  title,
  description,
  sectionId,
  media,
}: {
  title: string;
  description: string;
  sectionId: string;
  media: GuideMediaSection;
}) {
  const hasMedia = media.screenshots.length > 0 || media.videos.length > 0;

  return (
    <section
      style={{
        borderRadius: 18,
        padding: 18,
        background:
          'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.96) 100%)',
        border: '1px solid rgba(148,163,184,0.25)',
        color: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.78, marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 820, color: 'rgba(255,255,255,0.88)' }}>
            {description}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
            Folder: <code>{sectionId}/screenshots</code> and <code>{sectionId}/videos</code>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 16,
        }}
      >
        <MediaCollection title="Screenshots" items={media.screenshots} kind="image" />
        <MediaCollection title="Videos" items={media.videos} kind="video" />
        {!hasMedia && (
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px dashed rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.72)',
              fontSize: 13,
            }}
          >
            No media found yet. Add files to the folders above and they will appear here
            automatically.
          </div>
        )}
      </div>
    </section>
  );
}

function MediaCollection({
  title,
  items,
  kind,
}: {
  title: string;
  items: GuideMediaItem[];
  kind: 'image' | 'video';
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 14,
          border: '1px dashed rgba(255,255,255,0.18)',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, opacity: 0.8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>
          Add a {kind === 'image' ? 'screenshot' : 'video'} to this folder and it will appear here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12, opacity: 0.8 }}>{title}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {items.map(item => (
          <figure
            key={item.fileUrl}
            style={{
              margin: 0,
              borderRadius: 14,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
          >
            {kind === 'image' ? (
              <img
                src={item.fileUrl}
                alt={item.fileName}
                style={{
                  width: '100%',
                  height: 180,
                  objectFit: 'cover',
                  display: 'block',
                  background: 'rgba(15,23,42,0.18)',
                }}
              />
            ) : (
              <video
                controls
                style={{
                  width: '100%',
                  height: 180,
                  objectFit: 'cover',
                  display: 'block',
                  background: 'rgba(15,23,42,0.18)',
                }}
              >
                <source src={item.fileUrl} />
              </video>
            )}
            <figcaption
              style={{
                padding: '10px 12px',
                fontSize: 12,
                color: 'rgba(255,255,255,0.78)',
                wordBreak: 'break-word',
              }}
            >
              {item.fileName}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default UserGuide;
