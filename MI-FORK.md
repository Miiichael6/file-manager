# Mi fork de Dirwise

Copia privada de [arcly-studio/dirwise](https://github.com/arcly-studio/dirwise) (licencia MIT).

| Remoto     | URL                                              | Uso                              |
|------------|--------------------------------------------------|----------------------------------|
| `origin`   | https://github.com/Miiichael6/file-manager.git   | Mi repo: aquí subo mis cambios   |
| `upstream` | https://github.com/arcly-studio/dirwise.git      | Original: solo lectura (push = `DISABLE`) |

## Traer los cambios de ellos

```bash
git checkout master
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
git log --oneline master..upstream/master
git diff master...upstream/master --stat
```

## Archivos que modifiqué (posibles conflictos)

Todos los cambios llevan el comentario `MI-FORK` (`git grep MI-FORK`), salvo los de JSON, que no admite comentarios.

| Archivo | Cambio |
|---------|--------|
| `src/lib/updates.ts` | `LATEST_RELEASE` apunta a `Miiichael6/file-manager`; `RELEASE_PAGE` acepta mi repo |
| `src-tauri/src/main.rs` | `RELEASE_TAG_URLS` pasa de 3 a 4 entradas con mi repo; un `assert!` más en el test `accepts_only_release_tag_pages` |
| `src-tauri/tauri.conf.json` | `productName` y `app.windows[0].title` = "Mi Dirwise"; `identifier` = `com.miiichael6.midirwise`; quitado `bundle.windows.nsis.installerHooks` |

Archivos nuevos (no generan conflictos): `MI-FORK.md`.

Al resolver un conflicto en estos archivos, acepta lo de ellos y vuelve a aplicar encima solo mi cambio de la tabla.

## Notas

- **Repo privado y actualizaciones:** la API de GitHub sin token devuelve 404 en repos privados, así que mientras `file-manager` sea privado la app nunca avisará de versiones. El fallo es silencioso y ya no ofrece la versión oficial, que era el objetivo.
- **installerHooks quitado:** `src-tauri/nsis/hooks.nsh` falla si `productName` no es "Dirwise" y además migra claves de registro y desinstala el antiguo Finder-Win del Dirwise oficial. Si ellos cambian `hooks.nsh`, no me afecta.
- **Lo que sigue compartido con el Dirwise oficial:** la caché de iconos y miniaturas `%LOCALAPPDATA%\dirwise\` y el binario `dirwise.exe`. La configuración ya va aparte: `%APPDATA%\com.miiichael6.midirwise\`.
- **Textos de la UI:** la barra de título, Acerca de y las pestañas siguen mostrando "Dirwise" (está escrito a mano en `TitleBar.tsx`, `AboutDialog.tsx`, `TabBar.tsx`, `App.tsx` e `index.html`). Los dejé así para no sumar archivos con conflictos.
- **Rust con rustup en symlinks:** en esta máquina `~/.cargo/bin/cargo.exe` es un symlink y `tauri dev` dice "cargo ... program not found". Para esquivarlo:
  ```powershell
  $env:Path = "$env:USERPROFILE\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;" + $env:Path
  npm run tauri dev
  ```
  La solución de fondo es reinstalar los proxies de rustup como hardlinks (`rustup self uninstall` y reinstalar, o `rustup update`).

## Regla para mis mejoras

Cuando sea posible, pon mi código en archivos o módulos nuevos (por ejemplo `src/mi-fork/`, `src-tauri/src/mi_fork.rs`) en vez de reescribir los originales. En los originales deja solo el "enganche" mínimo: un import, una línea en un registro o una llamada, marcado con `MI-FORK`. Apunta cada archivo original que toques en la tabla de arriba.
