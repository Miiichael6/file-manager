; MI-FORK: ganchos del instalador NSIS (bundle.windows.nsis.installerHooks).
;
; Al desinstalar, el propio .exe quita lo que añadió Más → Integración con
; Windows (carpeta en el PATH de usuario y «Abrir en File Manager» en el menú
; del Explorador): `--unregister` limpia el registro y sale sin abrir ventana
; (src-tauri/src/mi_cli.rs). En una actualización (/UPDATE) no: el usuario
; conserva su integración y el .exe nuevo queda en la misma carpeta.

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --unregister'
  ${EndIf}
!macroend
