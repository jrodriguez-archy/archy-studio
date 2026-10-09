# Diagnóstico de sesión: Archy Studio (MCP) + Claude Code

**Fecha de la sesión:** 8 de octubre de 2026 (los servidores de Studio registran 9 de octubre, en UTC)
**Usuario:** Juan (jrodriguez@archy.com)
**Pedido inicial:** dos opciones de post para la cena de 15 personas de Archy en Phoenix (The Henry - Arcadia, jueves 22 de octubre de 2026, 6:00 – 9:00 PM)
**Herramientas usadas:** skill `archy-studio:studio` (v0.5.0), servidor MCP `plugin:archy-studio:archy-studio`, app web Archy Studio Canvas (`archystudio.vercel.app`)

---

## 1. Resumen ejecutivo

| Resultado | Estado |
|---|---|
| Opción 1, la probada ("A Free Night Out For Phoenix Dentists"): Square, Stories y OG | ✅ Entregada y descargada en 2x |
| Opción 2 ("Dinner's On Us, Phoenix Dentists") con la plantilla ilustrada: Square, Stories y OG | ✅ Entregada y descargada en 2x, aunque **no cumple** la regla del brief que pide un tratamiento visual distinto |
| Opción 2 con foto del lugar (`night-out-venue`) | ❌ No se hizo: no había foto de The Henry |
| Cover 1200×900 por `render` | ❌ Error: la plantilla exige dos fotos (`image-venue` e `image-photo`) |
| Cover editado a mano en Canvas (Medellín, fondo navy, foto cutout) | ⚠️ Editado pero **sin guardar**; los colores cambiaron sin explicación; la foto es el retrato de un niño |
| OG editado en Canvas (Medellín) | ⚠️ Editado pero **sin guardar**; el título dice Medellín y los datos siguen siendo de Phoenix |

**Conclusión:** el flujo brief → `match_templates` → `get_template` → `render` funcionó bien y rápido para el caso previsto: un evento organizado por Archy, con todos los datos y sin fotos. Los problemas aparecieron fuera de ese camino:
- autenticación al empezar la sesión;
- solo dos plantillas para eventos organizados por Archy y ninguna con temas;
- el cover no tiene versión sin fotos;
- los canvas se crean para formatos que no se pidieron;
- el estado de Canvas se desincroniza (colores, sincronización entre formatos, fotos de ejemplo que quedan puestas);
- el texto del diseño quedó mezclado con datos de otra ciudad.

---

## 2. Arquitectura observada

```
Usuario (chat)
   │
   ▼
Claude Code ──(Skill)──► archy-studio:studio  (instrucciones: leer brief → match → preguntar → get_template → render → entregar)
   │
   ├──(ToolSearch)──► carga diferida de los esquemas MCP
   │
   ▼
MCP plugin:archy-studio:archy-studio
   ├─ match_templates   → qué plantillas son posibles con los datos del brief
   ├─ list_templates    → catálogo
   ├─ get_template      → slots, límites por formato, qué es esencial
   ├─ list_assets       → imágenes subidas por el equipo (Canvas → Assets)
   ├─ render            → PNG 1x inline + link firmado 2x (Supabase) + link a Canvas
   ├─ get_canvas        → estado del diseño abierto en la app + captura
   ├─ edit_canvas       → cambios en vivo sobre el canvas (el usuario los ve y puede deshacerlos)
   └─ save_canvas       → guarda una versión nueva en la galería (no se usó)
   │
   ▼
App Archy Studio (archystudio.vercel.app/canvas/<id>)
   └─ "set" = agrupa todos los formatos de un mismo brief; cada formato es un canvas con su propio id
```

**Datos clave:**
- **Set:** `e18d98b8-56b4-4df6-bab9-c5fda4d8b1a0`
- **Canvas del set:**

| Formato | Canvas id | Creado por |
|---|---|---|
| Square | `a86f1ca1-625f-448b-9db7-84bfe1406444` | render Op2 |
| Stories | `2e80e8e2-b603-481a-9552-f032afa3b4b4` | render Op2 |
| OG | `f28ff7d5-2a94-4ddc-8ea4-5478c95dcc04` | render Op2 |
| Post | `cd6980d6-1141-4826-af01-0651ef1d194d` | **Nunca se pidió por render**; existe igual |
| Cover | `d0dd5b47-29aa-40a7-87f0-92e4a7a496bf` | **El render dio error**; existe igual, con fotos de ejemplo (Topgolf) |

- La Op1 está en la misma galería: Square `d8a2a5ca-…`, Stories `09a7a7e9-…` y OG `597155be-…`.
- **Links de descarga 2x:** URLs firmadas de Supabase con `exp − iat = 604800 s`, es decir, **caducan a los 7 días** (alrededor del 15 de octubre). Los PNG locales son la copia que dura.

---

## 3. Línea de tiempo y logs

> Formato: `#` · herramienta · entrada (resumen) → salida (resumen) · nota

### Fase A: arranque y bloqueo por autenticación

| # | Llamada | Entrada | Salida | Nota |
|---|---|---|---|---|
| A1 | `Skill` | `archy-studio:studio` con un resumen del brief | Skill cargada (instrucciones v0.5.0) | ✅ |
| A2 | (sistema) | — | `plugin:archy-studio:archy-studio` **requiere autenticación**; `rive` falla con `ECONNREFUSED` | ❌ El MCP todavía no estaba autorizado. Se le pidió al usuario que lo conectara en la configuración de conectores o con `/mcp`. `rive` no tenía que ver con esta tarea |

### Fase B: Opción 1 (la probada)

| # | Llamada | Entrada | Salida | Nota |
|---|---|---|---|---|
| B1 | `ToolSearch` | `select:match_templates,get_template,render,list_assets` | Esquemas cargados | Carga diferida: un viaje extra de ida y vuelta |
| B2 | `match_templates` | facts `[event-name, city, venue, date, time, person]`, purpose `hosted-evening` | Elegible: `night-out-illustration` (no muestra `person`). Posible con más datos: `night-out-venue` (le falta `venue-photo`) | ✅ Respuesta clara y útil |
| B3 | `list_assets` | search `Henry` | `[]` | No había fotos del lugar |
| B4 | `list_assets` | search `Phoenix` | `[]` | No había fotos de la ciudad |
| B5 | `get_template` | `night-out-illustration` | 5 formatos; slots `headline` (18 car./línea, 2 líneas), `subhead`, `city`, `venue`, `date`, `time`, `cta` (sin OG); el cover exige `image-venue`, `image-photo`, `headline-1/2`, `cover-subhead` | ✅ Límites por formato muy claros |
| B6 | `get_template` | `night-out-venue` | `image-venue` esencial en **todos** los formatos | Confirma que sin foto no hay Opción 2 "real" |
| B7 | `render` | `night-out-illustration`, formatos `square, stories, og`, título "A Free Night Out\nFor Phoenix Dentists" y demás slots | 3/3 **ready**. Ajustes: headline al 91% (square y stories) y 93% (OG); city 87%, venue 95%, date 87%, time 95%. Devuelve el `set` | ⚠️ En el square el título quedó en **3 líneas** ("For Phoenix / Dentists"), aunque el render lo dio por "ready" |
| B8 | `Bash` (curl ×3) | links 2x | `night-out-illustration-{square,stories,og}.png` de 2160×2160, 2160×3840 y 2400×1260 | ✅ |

### Fase C: Opción 2 (misma plantilla, otro texto)

| # | Llamada | Entrada | Salida | Nota |
|---|---|---|---|---|
| C1 | `render` | misma plantilla y `set`; headline "Dinner's On Us,\nPhoenix Dentists", subhead "Pull up a chair. Good food, good drinks, and zero agenda.", cta "Save Me a Seat" | 3/3 **ready**; el título entra en 2 líneas en todos los formatos | ✅ Técnicamente bien. ⚠️ Es el mismo diseño visual de la Op1: incumple "Different visual treatment, not just a copy swap" |
| C2 | `Bash` (curl ×3) | links 2x | `night-out-illustration-op2-{square,stories,og}.png` | ✅ |

### Fase D: pedido del cover, "Bucaramanga" y fondo navy

| # | Llamada | Entrada | Salida | Nota |
|---|---|---|---|---|
| D1 | `list_assets` | kind `pixel` | `[]` | Se buscó un fondo navy pixelado |
| D2 | `list_assets` | search `navy` | `[]` | |
| D3 | `ToolSearch` + `list_templates` | — | 10 plantillas; `night-out-illustration` **sin temas ni diseños alternativos** | Las plantillas con tema navy son booth, countdown y AE |
| D4 | `list_assets` | (sin filtro) | `[]` | La librería del equipo estaba vacía en ese momento |
| D5 | `render` | `night-out-illustration`, formato `cover`, slots de texto sin imágenes | **Error:** "needs image-venue, image-photo (essential content; it never goes out half empty)" | ❌ Contradice la descripción de `render`, que dice "without a photo the no-photo version is used". El cover no tiene esa versión |

### Fase E: "Medellín" y edición en Canvas

| # | Llamada | Entrada | Salida | Nota |
|---|---|---|---|---|
| E1 | (respuesta) | Usuario: "cambia Bucaramanga por Medellín" | Se pidieron fotos para el cover o los datos del evento de Medellín | Se evitó mezclar datos de Phoenix con otra ciudad |
| E2 | `ToolSearch` | `get_canvas, edit_canvas, save_canvas` | Esquemas cargados | |
| E3 | `get_canvas` | (el canvas abierto) | OG `f28ff7d5`; el título ya decía "Dinner's On Us, Bucaramanga Dentists" (**editado a mano por el usuario en la app**); ubicación y fecha de Phoenix; lista de componentes con ids y formatos hermanos | ✅ Muy buena introspección: ids, jerarquía, colores de marca, presets |
| E4 | `edit_canvas` | OG: `G3X-1` text → "Dinner's On Us, Medellín Dentists" | Aplicado; el Inspector no marca nada | ⚠️ Título de Medellín con ubicación "Phoenix, AZ / The Henry - Arcadia" |
| E5 | `get_canvas` | cover `d0dd5b47` | Cover **existente**: "Bucaramanga Dentists", fotos de ejemplo de Topgolf, subtítulo de golf | ❌ El render del cover dio error (D5), pero el canvas existe con contenido de ejemplo. Riesgo de publicar fotos y texto de otro evento |
| E6 | `edit_canvas` | cover: `IC6-0` → "Medellín Dentists"; `ICN-0` oculta; `IBZ-0` fill `blue-tint-800`; `IED-0` oculta; `IEE-0` → "Dinner, drinks and good company, on us" | Aplicado. Inspector: "Too much empty space: content fills 80%" | Fondo navy logrado. Al ocultar la foto queda un hueco |
| E7 | `edit_canvas` | cover: `IEE-0` → "Good food, good drinks and zero agenda" | Aplicado. Inspector: 82% | Se evitó repetir "on us" (ya está en el título) |

### Fase F: foto cutout

| # | Llamada | Entrada | Salida | Nota |
|---|---|---|---|---|
| F1 | `list_assets` | kind `cutout` | 1 asset: "images · cutout", 372×364, subido por Juan el 9 de octubre (UTC) | Se subió **durante** la sesión; en D4 la librería estaba vacía |
| F2 | `edit_canvas` | cover: `IED-0` hidden=false, image=`upload:…/d1c8f1d6-….png` | Aplicado; el Inspector no marca nada | ⚠️ La captura muestra la **tarjeta en azul rey con texto blanco y fondo degradado**: cambió la paleta, aunque esta llamada no la pidió. ⚠️ La foto es el retrato de un niño |

**Total de llamadas al MCP de Studio:** 19. Por herramienta:

| Herramienta | Llamadas |
|---|---|
| `match_templates` | 1 |
| `list_assets` | 7 |
| `get_template` | 2 |
| `list_templates` | 1 |
| `render` | 3 (2 OK, 1 error) |
| `get_canvas` | 2 |
| `edit_canvas` | 4 |
| `save_canvas` | 0 |

Además hubo 4 `ToolSearch` y 2 `Bash` (descargas).

---

## 4. Lo que funcionó bien ✅

1. **`match_templates` es muy útil.** Dice qué se puede hacer ya y qué falta para desbloquear algo mejor (`needs: venue-photo`). Permite hacer una sola pregunta bien enfocada.
2. **`get_template` es preciso.** Da límites de caracteres por línea y formato, y explica qué pasa si falta cada slot (`when_missing`). Con eso se escribe texto que entra a la primera.
3. **`render` es robusto con el texto.** Ajusta solo (91%, 87%…) sin romper el diseño y lo reporta. Devuelve la imagen inline, el link 2x y el link a Canvas en una sola respuesta.
4. **El concepto de `set`** agrupa las variantes de un mismo brief en la galería.
5. **`get_canvas` da una introspección excelente.** Componentes con id, jerarquía, colores de marca permitidos, presets de recolor y formatos hermanos, además de una captura del estado actual.
6. **`edit_canvas` en vivo con Inspector.** El usuario ve cada cambio, puede deshacerlo, y el Inspector avisa de problemas de diseño (el espacio vacío).
7. **Las reglas de la marca están en el servidor.** No se puede renderizar un cover "medio vacío", el logo de Archy está bloqueado y solo se permiten colores de marca. El servidor protege la identidad aunque el agente se equivoque.
8. **Calidad de salida.** PNG 2x nítidos y tipografía y espaciado consistentes con la marca.

## 5. Lo que falló o se puede mejorar ❌⚠️

### 5.1 Problemas de plataforma (MCP y app)

| # | Problema | Impacto | Sugerencia |
|---|---|---|---|
| P1 | El MCP **no estaba autenticado** al empezar; la skill se cargó igual | Primer turno perdido | Que la skill compruebe la conexión o que el plugin pida autorizar al instalarse |
| P2 | **Solo 2 plantillas** para eventos organizados por Archy, y la única sin foto **no tiene temas ni diseños alternativos** | La "Opción 2 nueva" del brief no se puede hacer sin foto: sale un simple cambio de texto | Añadir un tema (navy, royal, light) o un segundo diseño a `night-out-illustration` |
| P3 | El cover **exige 2 fotos** y no tiene versión sin foto | El cover navy no se puede renderizar | Una versión del cover sin foto, o que `image-photo` sea opcional |
| P4 | La descripción de `render` dice "without a photo the no-photo version is used", pero el cover da error | Expectativa equivocada del agente | Alinear la descripción con el comportamiento real por formato |
| P5 | **Se crean canvas de formatos no pedidos** (post y cover) y el cover sale con **fotos y texto de ejemplo** (Topgolf, golf) aunque el render falló | Riesgo alto de publicar contenido de otro evento | No crear canvas de formatos que fallan o no se pidieron, o marcarlos como "borrador incompleto" |
| P6 | **Cambio de paleta sin pedirlo** en el cover tras `edit_canvas` (de tarjeta blanca sobre navy a tarjeta azul rey con texto blanco y degradado) | Lo que se ve no es lo que se pidió; difícil de diagnosticar | Que `edit_canvas` informe de cambios de tema o recolor ajenos a la llamada (por ejemplo, de otro usuario o de la sincronización de formatos) |
| P7 | La **sincronización entre formatos** ("copy, images, recolour and styles follow between synced formats while it is open") no deja claro qué se propagó | El título "Medellín" puede haberse copiado a Square, Stories y Post sin que nadie lo vea | Que `edit_canvas` liste los formatos afectados por cada cambio |
| P8 | OG mide 1200×630 y el brief pide 1200×628 | Pequeña discrepancia con Meta | Confirmar si Ads acepta 630 o añadir un formato 1200×628 |
| P9 | El OG no tiene CTA | Diferente del brief ("CTA (bottom)") | Decisión de diseño; documentarla |
| P10 | En el square de la Op1 el título queda en 3 líneas y el render lo da por "ready" | Visualmente aceptable, pero fuera del límite de 2 líneas de `get_template` | Que `render` avise cuando se superan las líneas esperadas |
| P11 | El nombre del asset es "images · cutout": genérico y sin carpeta | Difícil de encontrar o reutilizar; no dice quién aparece | Pedir nombre y carpeta al subir |
| P12 | Los links 2x **caducan a los 7 días** | Si alguien los comparte, dejan de funcionar | Avisarlo en la respuesta o usar links de galería permanentes |
| P13 | Fecha en UTC (las rutas dicen 9 de octubre; para el usuario es el 8) | Confusión menor en rutas y metadatos | Usar la zona horaria del equipo |
| P14 | Carga diferida de herramientas (4 `ToolSearch`) | Latencia y llamadas extra | Normal en Claude Code; la skill podría precargar el set completo |

### 5.2 Errores o decisiones discutibles del agente (Claude)

| # | Qué pasó | Evaluación |
|---|---|---|
| C1 | La Op2 se hizo con la misma plantilla y solo otro texto | Lo pidió el usuario, y se avisó **antes y después** de que incumple el brief. Correcto, pero el resultado no sirve como "concepto nuevo" para Ads |
| C2 | Se puso "Medellín" en el OG manteniendo los datos de Phoenix | Pedido explícito del usuario; se avisó del desajuste. **Riesgo:** si se guarda o publica, el anuncio es incorrecto. Lo ideal era confirmar antes de editar |
| C3 | Se cambió el subtítulo del cover dos veces sin preguntar | El original hablaba de golf (ejemplo de la plantilla), así que cambiarlo era necesario. Aceptable; se informó |
| C4 | Se ocultó la foto del cover, lo que dejó un espacio vacío (Inspector al 80–82%) | Se avisó y se dieron dos soluciones. Correcto |
| C5 | Se insertó la foto de un niño en el slot de "gente disfrutando del lugar" | Se hizo porque el usuario lo pidió, y se avisó del problema de contexto y permisos. **No se debería publicar sin confirmarlo** |
| C6 | No se ejecutó `fix: "all"` cuando el Inspector avisó del espacio vacío | Correcto: el arreglo automático no resuelve un hueco de contenido |
| C7 | No se guardó nada con `save_canvas` | Correcto según la regla: guardar solo cuando el usuario lo pide. **Pendiente:** las ediciones del cover y del OG solo existen en el estado del canvas |
| C8 | No se renderizó el formato Post 1080×1350 | El brief no lo pedía; correcto |

---

## 6. Archivos generados (carpeta de trabajo)

| Archivo | Tamaño | Contenido |
|---|---|---|
| `night-out-illustration-square.png` | 2160×2160 | Op1 Square |
| `night-out-illustration-stories.png` | 2160×3840 | Op1 Stories |
| `night-out-illustration-og.png` | 2400×1260 | Op1 OG |
| `night-out-illustration-op2-square.png` | 2160×2160 | Op2 Square |
| `night-out-illustration-op2-stories.png` | 2160×3840 | Op2 Stories |
| `night-out-illustration-op2-og.png` | 2400×1260 | Op2 OG (versión Phoenix, **antes** de la edición a Medellín) |
| `diagnostico-archy-studio-2026-10-08.md` | — | Este documento |

**No hay archivo local** del cover ni del OG con Medellín: solo existen en Canvas y sin guardar.

---

## 7. Estado pendiente y siguientes pasos

1. **Decidir sobre Medellín:**
   - si es un evento real, pasar ciudad, lugar, fecha y hora y renderizarlo como un set nuevo, aparte del de Phoenix;
   - si era una prueba, restaurar el OG a "Phoenix Dentists" (`edit_canvas` con `reset`).
2. **Cover:** confirmar la foto (o cambiarla por gente en un restaurante), decidir entre tarjeta blanca sobre navy y la paleta azul actual, y después usar `save_canvas`.
3. **Revisar los formatos hermanos** (Square, Stories y Post del set) por si la sincronización copió "Bucaramanga" o "Medellín".
4. **Opción 2 "real" para Phoenix:** conseguir una foto de The Henry - Arcadia y renderizar `night-out-venue` (por ejemplo, "Dinner's On Us, Phoenix." con perks "Seated dinner, drinks & good company in Arcadia").
5. **Enviar a Marketing & Design** los puntos P2–P7 y P10: son los que más afectan a la calidad del trabajo.

---

## 8. Puntuación rápida

| Área | Nota | Comentario |
|---|---|---|
| Brief → plantilla (`match_templates` y `get_template`) | 9/10 | Claro, con buenas preguntas guiadas |
| Render (calidad y ajuste de texto) | 8/10 | Excelente; falta avisar del exceso de líneas |
| Cobertura del catálogo (eventos organizados por Archy) | 4/10 | Poco variada; sin temas ni cover sin foto |
| Canvas: introspección (`get_canvas`) | 9/10 | Muy completa |
| Canvas: consistencia de estado (`edit_canvas`, sincronización, set) | 5/10 | Cambios de paleta sin explicar, canvas con datos de ejemplo, sincronización opaca |
| Onboarding y autenticación | 5/10 | Bloqueo en el primer turno |
| Comportamiento del agente | 8/10 | Avisó de los riesgos y no inventó datos; podría haber confirmado antes de editar con datos mezclados |
