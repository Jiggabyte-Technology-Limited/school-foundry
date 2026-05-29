; Custom uninstall script for SchoolFoundry
; Shows a confirmation dialog before uninstalling and a goodbye dialog after

!macro customUnInstall
  ; --- Confirmation prompt before uninstalling ---
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
    "Are you sure you want to uninstall SchoolFoundry?$\r$\n$\r$\nYour school data stored in AppData will NOT be deleted, but your license activation will be removed." \
    IDYES doUninstall
  Abort

  doUninstall:
  Delete "$APPDATA\schoolfoundry\license.lic"
!macroend

!macro customUnInstallEnd
  ; --- Goodbye message shown after files are removed ---
  MessageBox MB_OK|MB_ICONINFORMATION \
    "SchoolFoundry has been successfully uninstalled.$\r$\n$\r$\nThank you for using SchoolFoundry.$\r$\nYour data files have been preserved, but you will need to re-activate your license upon reinstall."
!macroend
