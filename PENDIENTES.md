# Pendientes – funcionalidades a desarrollar

Comparación con **Folders File Manager / Folders Pro** (gestor de archivos para macOS centrado en el árbol de carpetas, pensado para quien viene de Windows). Lista lo que tiene Folders y a esta app todavía le falta.

Lo que **ya tenemos** y no hace falta repetir: pestañas, vista dividida, vistas Iconos / Lista / Columnas, vista previa con Espacio, paleta de comandos, portapapeles real de Windows, arrastrar y soltar en ambos sentidos, Deshacer / Rehacer, Papelera (ver, restaurar, vaciar), etiquetas de color, Acceso rápido, Recientes, «Abrir con ▸» para carpetas, lista de saltos, continuar como administrador.

Marca cada casilla al terminarla. Prioridad: 🔴 alta · 🟡 media · 🟢 baja.

---

## 1. Árbol de carpetas (la base de Folders) 🔴

- [ ] **Vista de árbol** en el sidebar o como cuarta vista: carpetas que se expanden y contraen (▸ / ▾) sin salir de la carpeta actual.
- [ ] Carga perezosa de los hijos (solo al expandir) y virtualización para árboles grandes.
- [ ] El árbol sigue a la carpeta actual (se expande y resalta la ruta al navegar).
- [ ] Teclado en el árbol: ←/→ contrae/expande, ↑/↓ mueve, Enter abre, `*` expande todo el subárbol.
- [ ] Arrastrar y soltar archivos sobre nodos del árbol (mover / copiar, con expansión automática al pasar por encima).
- [ ] Mostrar archivos dentro del árbol (opcional, no solo carpetas).
- [ ] Expandir **enlaces simbólicos / uniones (junctions)** como carpetas, con un indicador visual y protección contra ciclos.
- [ ] Recordar qué nodos estaban expandidos (por pestaña, en `settings.json`).

## 2. Git integrado 🔴

- [ ] Detectar si la carpeta está dentro de un repositorio Git.
- [ ] Estado por archivo en el árbol y en la lista: modificado, nuevo, eliminado, ignorado, en conflicto (iconos o colores).
- [ ] Rama actual en la barra de estado.
- [ ] Acciones: **stage / unstage**, **commit** (con mensaje), **push**, **pull**.
- [ ] Ver diff de un archivo en la vista previa.
- [ ] Decidir implementación: llamar a `git.exe` (sin dependencias nativas nuevas) o crate `git2` (requiere aprobación – nueva dependencia nativa).

## 3. Organización: etiquetas, valoraciones y metadatos 🟡

- [ ] **Etiquetas de texto** libres además de las de color (crear, renombrar, borrar; filtrar por ellas en la paleta y el sidebar).
- [ ] **Valoración con estrellas** (1–5) por archivo, visible como columna en la vista Lista y ordenable.
- [ ] Mostrar etiquetas y estrellas también en el árbol.
- [ ] Decidir dónde se guardan: `settings.json` / base propia, o metadatos de Windows (`System.Rating`, `System.Keywords`) para que se vean en el Explorador.

## 4. Favoritos y sidebar 🟡

- [ ] **Reordenar Favoritos / Acceso rápido** arrastrando.
- [ ] Grupos o secciones personalizadas en el sidebar.
- [ ] Renombrar un favorito sin renombrar la carpeta (alias).

## 5. Acciones personalizadas 🟡

- [ ] **Acciones de usuario**: comandos de PowerShell / cmd / scripts que se ejecutan sobre la selección o la carpeta actual (equivalente a las acciones shell/AppleScript de Folders Pro).
- [ ] Variables en la acción: `{path}`, `{name}`, `{dir}`, `{selection}`.
- [ ] Mostrarlas en el menú contextual, en la paleta (Ctrl+K) y con atajo opcional.
- [ ] Editor de acciones en Más → Ajustes (guardado en `settings.json`).
- [ ] Recordar: lanzar con `ShellExecuteW`, no `Command::spawn` (la app no tiene consola).

## 6. Línea de comandos 🟡

- [ ] Abrir la app desde terminal en una carpeta: `file-manager.exe C:\ruta` (ya hay `single-instance`: reenviar la ruta a la instancia abierta como pestaña nueva).
- [ ] Opciones: `--new-window`, `--select <archivo>` (abrir la carpeta con el archivo seleccionado).
- [ ] Añadir la carpeta del ejecutable al PATH desde el instalador (opcional).
- [ ] Entrada «Abrir en File Manager» en el menú contextual del Explorador (opcional, registro HKCU).

## 7. Dispositivos móviles 🟢

- [ ] Explorar teléfonos conectados por USB (MTP: Android / iPhone) desde «Este equipo», vía Shell API (`IShellItem` sobre dispositivos portátiles).
- [ ] Copiar fotos/archivos desde y hacia el dispositivo.

## 8. Extras útiles (no están en Folders, pero completan la app) 🟢

- [ ] Comprimir / descomprimir ZIP desde el menú contextual.
- [ ] Renombrado por lotes (patrón, numeración, buscar y reemplazar) con vista previa.
- [ ] Calcular tamaño de carpetas (en segundo plano, columna en la vista Lista).
- [ ] Agrupar por tipo / fecha / tamaño en la vista Lista.
- [ ] Vista previa de diff de texto entre dos archivos seleccionados.

---

## Notas antes de empezar

- Cada funcionalidad nueva: textos en `en.ts`, `cs.ts` **y** `es.ts` (`npm run i18n:check`), comando en `src/commands.ts` si tiene atajo o va en la paleta.
- Código del fork en `src/mi-fork/` y `src-tauri/src/mi_fork.rs`, con el comentario `MI-FORK` donde se toque código de upstream; anotar el archivo en la tabla de [MI-FORK.md](MI-FORK.md).
- Dependencias nativas nuevas o más de ~150 líneas de Rust: planificar antes.
- Fuente de la comparación: [Folders Pro en Product Hunt](https://www.producthunt.com/p/folders/folders-pro), [Folders File Manager en App Store](https://apps.apple.com/gb/app/id1593644229).
