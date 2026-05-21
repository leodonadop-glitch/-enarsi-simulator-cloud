# ENARSI Exam Simulator

Cisco IOS-XE CLI simulator and multiple-choice / drag-and-drop exam preparation tool for the Cisco 300-410 ENARSI exam.

---

## 📦 Project Structure — Three Apps

There are **three separate apps** in this workspace. Each has a specific role:

| Carpeta | Rol | Backend | Deploy |
|---|---|---|---|
| `enarsi-simulator` | ⚠️ Legacy / Archivado | localStorage básico | Local only |
| `enarsi-simulator-local` | 🧪 **Staging / Pruebas** | Supabase (mismo que cloud) | Local `npm run dev` |
| `enarsi-simulator-cloud` | 🚀 **Producción** | Supabase + Cloudflare Pages | `wrangler pages deploy` |

> ⚠️ **No usar `enarsi-simulator`** para desarrollo activo. Es una versión antigua sin auth ni features completas. El staging correcto es `enarsi-simulator-local`.

---

## 🔄 Flujo de Trabajo — Regla de Oro

```
Desarrollo  →  enarsi-simulator-local  →  Validación + Aprobación  →  enarsi-simulator-cloud
                      🧪 Staging                   ✅ Obligatorio              🚀 Producción
```

> [!CAUTION]
> **Regla absoluta:** Ningún cambio va a cloud sin haber sido validado y aprobado en `enarsi-simulator-local` primero. Sin excepción.

### Pasos obligatorios

1. **Implementar** el cambio en `enarsi-simulator-local`
2. **Levantar** el servidor local: `npm run dev` → `http://127.0.0.1:5174`
3. **Validar manualmente** el flujo afectado (fullscreen, navegación, labs, etc.)
4. **Obtener aprobación** (tuya o de Atlas) antes de continuar
5. **Replicar** los cambios en `enarsi-simulator-cloud`
6. **Build limpio** en cloud: `npm run build`
7. **Deploy** a Cloudflare Pages: `npx wrangler pages deploy dist`
8. **Commit + Push** a Git: pasos separados, nunca encadenados

---

## 🚀 Levantar Entorno de Desarrollo

### App Staging (enarsi-simulator-local)
```bash
cd enarsi-simulator-local
npm install       # primera vez
npm run dev
```
Abre: **http://127.0.0.1:5174**

### App Producción (preview local)
```bash
cd enarsi-simulator-cloud
npm install       # primera vez
npm run dev
```
Abre: **http://localhost:5173**

---

## 🏗️ Build y Deploy (Solo Producción)

Ejecutar en orden separado — nunca encadenar en una sola línea:

```bash
# 1. Build limpio
npm run build

# 2. Deploy a Cloudflare Pages
npx wrangler pages deploy dist

# 3. Commit y push (después de confirmar que el deploy fue exitoso)
git add .
git commit -m "feat: descripción del cambio"
git push
```

---

## 🧪 Tests del Simulador CLI

Validar la lógica del motor IOS-XE antes de cualquier deploy:

```bash
cd enarsi-simulator-cloud
node test-simulator.js
```

Debe terminar con `All tests completed!` y exit code 0.

---

## 📂 Archivos Clave

### Motor CLI
- **[src/lib/ios-simulator/index.js](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/src/lib/ios-simulator/index.js)** — Motor IOS-XE: 19 modos de configuración, prefix-matching multi-palabra, autocompletado, historial `{ typed, normalized }`.
- **[test-simulator.js](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/test-simulator.js)** — Suite de pruebas unitarias del motor CLI.

### Componentes UI
- **[src/components/LabCliSimulator.jsx](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/src/components/LabCliSimulator.jsx)** — Terminal interactiva, protección del prompt, evaluación de rúbricas.
- **[src/components/QuestionViewer.jsx](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/src/components/QuestionViewer.jsx)** — Preguntas múltiple elección, drag-and-drop, lightbox de imágenes.

### Datos y Backend
- **[src/data.json](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/src/data.json)** — 483 preguntas con respuestas, imágenes y comandos de labs esperados. **No modificar manualmente.**
- **[supabase-schema.sql](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/supabase-schema.sql)** — Schema y políticas RLS de Supabase. **No modificar sin auditoría.**
- **[scripts/enrich_data_advanced.cjs](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/scripts/enrich_data_advanced.cjs)** — Script de enriquecimiento de datos OCR. **No modificar.**

---

## 🤖 Agentes: Forge y Atlas

Este proyecto usa dos roles de agente de IA durante el desarrollo:

### 🛠️ Forge — El Constructor
- Implementa features, refactoriza código, extiende el parser IOS-XE
- Agrega nuevos modos de configuración CLI y actualiza los tests
- Ejecuta build → deploy → commit en pasos **separados**
- Entrega reporte con evidencia de pruebas tras cada cambio

### ⚖️ Atlas — El Auditor
- Valida seguridad: RLS de Supabase, ausencia de `dangerouslySetInnerHTML`, fronteras cliente/servidor
- Revisa regresiones: que labs anteriores no se rompan con cambios nuevos
- Da **APPROVE** o **HOLD** antes de cualquier deploy a producción
- Exige evidencia concreta — no acepta afirmaciones sin prueba

**Regla operativa:** Forge no despliega a producción sin APPROVE de Atlas.
