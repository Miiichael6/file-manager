# Mi fork de Dirwise

Copia privada de [arcly-studio/dirwise](https://github.com/arcly-studio/dirwise) (licencia MIT).

| Remoto     | URL                                              | Uso                              |
|------------|--------------------------------------------------|----------------------------------|
| `origin`   | https://github.com/Miiichael6/file-manager.git   | Mi repo: aquí subo mis cambios   |
| `upstream` | https://github.com/arcly-studio/dirwise.git      | Original: solo lectura (push = `DISABLE`) |

Mi rama es `main`; la de ellos es `master` (`upstream/master`).

## Traer los cambios de ellos

```bash
git checkout main
git status                     # debe estar limpio; si no, haz commit o git stash
git fetch upstream
git merge upstream/master      # si hay conflictos: resolver, git add <archivo>, git commit
npm install                    # por si cambiaron dependencias
npm run build                  # comprobación rápida (i18n + tsc + vite)
git push                       # sube el resultado a mi origin
```

Para ver qué traen antes de fusionar:

```bash
git fetch upstream
git log --oneline main..upstream/master
git diff main...upstream/master --stat
```

## Archivos que modifiqué (posibles conflictos)

Todos los cambios llevan el comentario `MI-FORK` (`git grep MI-FORK`), salvo los de JSON, que no admite comentarios.

| Archivo | Cambio |
|---------|--------|
| `src/lib/updates.ts` | `LATEST_RELEASE` apunta a `Miiichael6/file-manager`; `RELEASE_PAGE` acepta mi repo |
| `src-tauri/src/main.rs` | `RELEASE_TAG_URLS` pasa de 3 a 4 entradas con mi repo; un `assert!` más en el test `accepts_only_release_tag_pages`; `mod mi_fork;`, 5 commands en `generate_handler!` («Abrir con ▸» para carpetas, lista de saltos) y el plugin `tauri_plugin_single_instance` (primer `.plugin`) |
| `src-tauri/Cargo.toml` (+ `Cargo.lock`) | Dependencia `tauri-plugin-single-instance` y feature `Win32_System_Com_StructuredStorage` del crate `windows` |
| `.gitignore` | `.claude/worktrees/` (worktrees dentro del proyecto) |
| `vite.config.ts` | `**/.claude/worktrees/**` en `server.watch.ignored` (que Vite no vigile las copias de los worktrees) |
| `package.json` | Script `release` (`scripts/mi-fork/release.mjs`: `tauri build` con rustup en el PATH) |
| `src-tauri/tauri.conf.json` | `productName` y `app.windows[0].title` = "File Manager"; `mainBinaryName` = `file-manager`; `identifier` = `com.miiichael6.midirwise`; quitado `bundle.windows.nsis.installerHooks` |
| `src/commands.ts` | Comando `toggleLiquidGlass` (CommandId + DEFINITIONS) |
| `src/App.tsx` | Import de `mi-fork/liquidGlass`, `useLiquidGlass()` y el handler `toggleLiquidGlass`; «Abrir con…» en el menú de la vista previa; submenú «Abrir con ▸» de carpetas y del fondo de la carpeta actual (`folderOpenWithMenu`); `<FolderOpenButton>` pasado al Toolbar; `useJumpList(…)` tras `openTab` |
| `src/components/Toolbar.tsx` | Entrada «Liquid Glass» en Más → Apariencia; prop `openWith` (botón «Abrir carpeta con» antes de Compartir) |
| `src/components/Sidebar.tsx` | «Abrir con…» en el menú de archivos de Acceso rápido y Recientes; Recientes: animación al quitar y clic con la rueda = pestaña nueva (prop `onOpenTab`) |
| `src/components/StatusBar.tsx` | Botón copiar ruta y clic en el hueco = editar ruta (prop `onCopyPath`) |
| `index.html`, `TitleBar.tsx`, `AboutDialog.tsx`, `TabBar.tsx`, `App.tsx` | Nombre visible "File Manager" en vez de "Dirwise"; en `TitleBar.tsx`, " @ Development" detrás del nombre con `import.meta.env.DEV` (solo en `tauri dev`) |
| `src-tauri/icons/*`, `src/assets/icon.png`, `app-icon.png` | Icono propio generado con `npx tauri icon src-tauri/icons/file-manager.svg` (al traer cambios: quedarse con los míos) |
| `src/i18n/en.ts`, `src/i18n/cs.ts` | `toolbar.about` con "File Manager"; claves `liquidGlass.menu`, `liquidGlass.toggle`, `liquidGlass.hint` (también en `es.ts`, que es del fork) |
| `src-tauri/src/main.rs` (Git) | `mod git; mod git_parse;` y 7 commands `git::git_*` en `generate_handler!` |
| `src/App.tsx` (Git) | Git: `useGitIntegration`, `GitDialog`, `...git.handlers` en los comandos, `...git.menuItems(targets)` en el menú contextual, props `git`/`onGitClick` del `StatusBar` |
| `src/commands.ts` (Git) | Comandos `gitPanel` (Ctrl+Shift+G), `gitStage`, `gitUnstage`, `gitPull`, `gitPush` |
| `src/components/{ListView,IconView,ColumnView}.tsx` | `<GitBadge>` junto al nombre (IconView: `relative` en la celda) |
| `src/components/QuickLook.tsx` | Botón **Diff** (con icono) y `<GitDiffView>` en lugar de la vista previa |
| `src/components/ContextMenu.tsx` | Posición del menú con `offsetWidth`/`offsetHeight` en vez de `getBoundingClientRect()` (la animación `scale(0.96)` lo medía un 4 % más bajo y abajo de la ventana se cortaba el final). Fallo también en el original: si ellos lo arreglan, quedarse con lo suyo |
| `src/components/CommandPalette.tsx` | Icono propio para los comandos `git*` (`gitCommandIcon(command.id) ?? <Zap>`) |
| `src/components/StatusBar.tsx` (Git) | Props `git`, `onGitClick` y `<GitBranchChip>` |
| `src/index.css` | Variables `--git-*` (claro y oscuro) |
| `src/main.tsx` | Import de `mi-fork/light-style.css` y `mi-fork/dark-style.css` justo después de `index.css` (estilos claro y oscuro) y `mi-fork/menu-style.css` |
| `src/components/ContextMenu.tsx` | `withMenuIcons` sobre los ítems, `icon` en submenús, fila de colores de etiquetas en línea (no submenú) |
| `src/i18n/cs.ts`, `en.ts` (Git) | Claves `git.*`, `error.git*` al final (también en `es.ts`) |

Archivos nuevos (no generan conflictos): `MI-FORK.md`, `src/mi-fork/liquidGlass.ts` (estado, guardado en settings.json con la clave `miLiquidGlass`), `src/mi-fork/liquid-glass.css` (material bajo `:root[data-liquid]`), `src/mi-fork/folderApps.ts` + `src-tauri/src/mi_fork.rs` («Abrir con ▸» para carpetas; apps elegidas en settings.json, claves `miFolderApps` y `miFolderAppLast`), `src/mi-fork/FolderOpenButton.tsx` + `folder-open.css` (botón de la barra), `src/mi-fork/jumpList.ts` (carpetas recientes en la lista de saltos del icono; clave `miRecentFolders`), `src/mi-fork/lens.ts` (refracción en los bordes: mapa de desplazamiento por elemento + `feDisplacementMap` en `backdrop-filter`); Git integrado: `src-tauri/src/git.rs`, `git_parse.rs`, `src/lib/{git,gitStore,gitActions,useGitIntegration}.ts`, `src/lib/gitIcons.tsx`, `src/components/Git{Badge,BranchChip,Dialog,DiffView}.tsx`; `src/mi-fork/light-style.css` (estilo claro: selección azul sólida con texto blanco, barra lateral con tinte azul esmerilado, menús blancos esmerilados, rayas sutiles; superficies blancas; solo bajo `:root:not(.dark)`); `src/mi-fork/dark-style.css` (estilo oscuro: superficies grafito #1e1e1e, barra lateral algo más clara, selección azul sólida #0a64d6 con texto blanco, menús oscuros con resaltado azul; solo bajo `:root.dark`); `src/mi-fork/menuIcons.tsx` + `menu-style.css` (menú contextual con iconos lucide por ítem, reconocidos por el texto traducido; texto alineado en ítems sin icono; etiquetas como fila de círculos).

Al resolver un conflicto en estos archivos, acepta lo de ellos y vuelve a aplicar encima solo mi cambio de la tabla.

## Notas

- **Repo privado y actualizaciones:** la API de GitHub sin token devuelve 404 en repos privados, así que mientras `file-manager` sea privado la app nunca avisará de versiones. El fallo es silencioso y ya no ofrece la versión oficial, que era el objetivo.
- **installerHooks quitado:** `src-tauri/nsis/hooks.nsh` falla si `productName` no es "Dirwise" y además migra claves de registro y desinstala el antiguo Finder-Win del Dirwise oficial. Si ellos cambian `hooks.nsh`, no me afecta.
- **Lo que sigue compartido con el Dirwise oficial:** la caché de iconos y miniaturas `%LOCALAPPDATA%\dirwise\`. La configuración ya va aparte: `%APPDATA%\com.miiichael6.midirwise\`.
- **Nombre:** la app se llama "File Manager" (`file-manager.exe`); se instala aparte del Dirwise oficial. Quedan menciones de "Dirwise" en textos secundarios (errores de actualización, otros idiomas).
- **Rust con rustup en symlinks:** en esta máquina `~/.cargo/bin/cargo.exe` es un symlink y `tauri dev` dice "cargo ... program not found". Para esquivarlo:
  ```powershell
  $env:Path = "$env:USERPROFILE\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;" + $env:Path
  npm run tauri dev
  ```
  La solución de fondo es reinstalar los proxies de rustup como hardlinks (`rustup self uninstall` y reinstalar, o `rustup update`).

## Git integrado

- Llama a `git.exe` del PATH (sin dependencias nativas nuevas, sin `git2`). Sin Git instalado o fuera de un repo no aparece nada.
- Estado por archivo (M, U, A, D, R, ! conflicto, I ignorado; carpetas con un punto), rama + ↑↓ + cambios en la barra de estado, diálogo **Git** (clic en la rama o Ctrl+Shift+G): stage/unstage, diff, commit (Ctrl+Enter), push, pull. Stage/Unstage también en el menú contextual y la paleta; **Diff** en la vista previa (Espacio).
- `GIT_TERMINAL_PROMPT=0`: push/pull sin credenciales guardadas (Git Credential Manager) falla con error en vez de quedarse esperando. Rama sin upstream → `push --set-upstream origin HEAD`. Pull = `git pull --no-edit`.

## Regla para mis mejoras

Cuando sea posible, pon mi código en archivos o módulos nuevos (por ejemplo `src/mi-fork/`, `src-tauri/src/mi_fork.rs`) en vez de reescribir los originales. En los originales deja solo el "enganche" mínimo: un import, una línea en un registro o una llamada, marcado con `MI-FORK`. Apunta cada archivo original que toques en la tabla de arriba.
