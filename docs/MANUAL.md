# Manual de Qat

Este manual explica el flujo diario de Qat sin entrar en detalles internos. La idea es que un QA manual pueda instalarlo y empezar a usarlo rápidamente.

## 1. Instalar

Requisitos:

- Node.js 18 o superior.
- Claude CLI instalado y autenticado.
- Acceso a Jira Cloud.
- Xray es opcional: si no tenés acceso por API, Qat puede generar archivos importables.

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm install
cp .env.example .env
```

## 2. Ejecutar el setup

La forma recomendada de configurar Qat por primera vez es:

```bash
npm run setup
```

Durante el setup, Qat pregunta si usás Xray.

Si respondés que no, deja Xray deshabilitado.

Si respondés que sí, pregunta si tenés credenciales/API disponibles para Xray.

### Con API

Qat guarda:

```env
XRAY_ENABLED=true
XRAY_MODE=api
```

Los secretos reales deben quedar únicamente en `.env` o variables de entorno. Nunca se guardan en el repositorio.

Para Xray Cloud también existen estas variables opcionales:

```env
XRAY_CLIENT_ID=
XRAY_CLIENT_SECRET=
```

La implementación actual de creación/actualización de Tests sigue usando las operaciones Jira/Xray disponibles en el proyecto; estas variables quedan preparadas para el adapter nativo de Xray Cloud.

### Sin API

Si no tenés acceso por API, Qat ofrece modo exportación:

```env
XRAY_ENABLED=true
XRAY_MODE=export
XRAY_EXPORT_FORMAT=csv
```

También podés elegir `json`.

En este modo, cuando pedís crear tests en Xray, Qat no intenta escribir en Jira/Xray. Genera un archivo importable en `artifacts/`.

Ejemplo:

```text
artifacts/QA-123-xray-import.csv
```

El CSV incluye Summary, Issue Type, Description, Labels, Test Type, Priority, Source Issue y Case ID. Estos campos pueden mapearse durante el import de Jira/Xray según la configuración de cada empresa.

## 3. Configurar Jira y ambiente

Completá Jira en `.env`:

```env
JIRA_BASE_URL=https://tuempresa.atlassian.net
JIRA_EMAIL=tu.email@empresa.com
JIRA_API_TOKEN=tu_token
```

Configurá el ambiente que estás probando:

```env
QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
QAT_USER=usuario_qa
QAT_PASSWORD=password_qa
```

Usuario/password son opcionales. Nunca commitees `.env` ni copies secretos en casos de prueba.

## 4. Verificar que todo esté listo

```bash
npm run doctor
```

También podés ejecutar los tests internos:

```bash
npm test
```

`doctor` informa si Claude, Jira, Xray y el ambiente están configurados, pero no muestra passwords ni tokens. Para Xray muestra además si está en modo `api` o `export`.

## 5. Usar lenguaje natural

La forma recomendada de trabajar es escribir lo que querés hacer.

```bash
npm run qat -- "analiza QA-123 y genera casos de prueba"
```

Otros ejemplos:

```bash
npm run qat -- "genera los casos de QA-123 y guárdalos"
npm run qat -- "sube los tests de QA-123 a Xray sin modificar"
npm run qat -- "crea los tests de QA-123 en Xray"
npm run qat -- "comenta QA-123 indicando que el smoke pasó correctamente"
npm run qat -- "adjunta ./evidence/error-login.png a QA-123"
```

La frase no tiene que ser idéntica a estos ejemplos. Qat intenta reconocer acciones frecuentes localmente y usa Claude como fallback cuando necesita interpretar una instrucción más libre.

## 6. Qué pasa cuando pedís crear casos en Xray

El mismo pedido funciona en ambos modos:

```bash
npm run qat -- "crea los tests de QA-123 en Xray"
```

Con `XRAY_MODE=api`, Qat crea o actualiza Tests.

Con `XRAY_MODE=export`, Qat genera automáticamente un archivo importable y muestra su ubicación:

```text
✓ 12 casos exportados para Xray
✓ Archivo importable: artifacts/QA-123-xray-import.csv
```

Esto permite usar Qat incluso cuando la empresa no habilita API para Xray.

## 7. Flujo recomendado por ticket

Para `QA-123`:

1. `analiza QA-123 y genera casos de prueba`.
2. Revisá los casos y las ambigüedades detectadas.
3. Pedí crear los tests en Xray.
4. Si tenés API, Qat los sincroniza. Si no, genera el archivo importable.
5. Ejecutá manualmente los casos.
6. Registrá resultados y evidencia.
7. Publicá el Test Execution cuando corresponda.

## 8. Registrar una ejecución

En v0.5 los Test Executions completos todavía usan un JSON para que PASS/FAIL y las evidencias no sean ambiguos.

```bash
cp examples/execution.example.json execution.json
```

Ejemplo:

```json
{
  "summary": "Regression login - QA-123",
  "tests": [
    {
      "id": "TC-001",
      "key": "QA-501",
      "title": "Login válido",
      "status": "PASS"
    },
    {
      "id": "TC-002",
      "key": "QA-502",
      "title": "Password inválido",
      "status": "FAIL",
      "note": "Devuelve error 500",
      "evidence": ["./evidence/error-login.png"]
    }
  ]
}
```

Estados permitidos: `PASS`, `FAIL`, `BLOCKED`, `TODO`.

Validá primero:

```bash
npm run qat -- execute QA-123 execution.json --dry-run
```

Publicá después:

```bash
npm run qat -- execute QA-123 execution.json
```

## 9. Cambiar de ambiente

Por ahora se mantiene simple: editá `.env`.

QA:

```env
QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
```

Staging:

```env
QAT_ENV=staging
QAT_BASE_URL=https://staging.tuapp.com
```

Después ejecutá `npm run doctor` para confirmar el ambiente activo.

## 10. Seguridad

Qat sigue estas reglas:

- `.env` no se sube a Git.
- No imprime passwords ni tokens.
- Las evidencias no se mandan a Claude.
- Los passwords de prueba no se mandan a Claude.
- Claude interpreta intención; no recibe secretos.
- Sin API de Xray se usa exportación local en vez de forzar credenciales.
- Para cambios importantes conviene usar dry-run primero.

## 11. Ahorro de tokens

Qat intenta evitar llamadas innecesarias al LLM:

- interpreta localmente instrucciones conocidas;
- cachea generación de casos;
- limita el contexto del ticket;
- no envía binarios ni secretos;
- separa generación, sincronización y ejecución.

## 12. Comandos clásicos

```bash
npm run setup
npm run doctor
npm test
npm run qat -- generate QA-123 --save
npm run qat -- xray-sync QA-123 --dry-run --save
npm run qat -- xray-sync QA-123
npm run qat -- execute QA-123 execution.json --dry-run
npm run qat -- execute QA-123 execution.json
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
npm run qat -- evidence QA-123 ./evidence/login.png
```

## 13. Problemas comunes

### Claude CLI no aparece

```bash
claude --version
```

Si la empresa usa un wrapper, configurá `CLAUDE_COMMAND` en `.env`.

### Jira devuelve 401/403

Revisá `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` y los permisos del usuario.

### No tengo API de Xray

Ejecutá:

```bash
npm run setup
```

Elegí Xray y respondé que no tenés API. Qat configurará `XRAY_MODE=export`.

### Xray no crea el tipo correcto

Los nombres dependen de la instalación. Revisá `XRAY_TEST_ISSUE_TYPE`, `XRAY_EXECUTION_ISSUE_TYPE` y los tipos de link.

### El CSV necesita campos distintos

Cada instancia de Jira/Xray puede tener custom fields diferentes. El CSV de Qat usa un conjunto base y el importador permite mapear columnas. Más adelante agregaremos perfiles de importación configurables.

## 14. Qué viene después

La siguiente evolución apunta a poder escribir directamente algo como:

```text
QA-123: TC-001 pasó, TC-002 falló por error 500 y adjunta error.png
```

Qat debería convertirlo en un Test Execution sin necesidad de preparar `execution.json`. Después avanzaremos sobre Test Runs nativos de Xray, adapter nativo para Xray Cloud, detección automática de configuración, Test Plans/suites y perfiles de importación.
