# Manual de Qat

Este manual explica el flujo diario de Qat para QA manual. La idea es que la configuración inicial tenga algunos pasos explícitos, pero que el trabajo cotidiano sea simple y, progresivamente, pueda hacerse en lenguaje natural.

## 1. Instalar

Requisitos:

- Node.js 18 o superior.
- Claude CLI instalado y autenticado.
- Acceso a Jira Cloud.
- Xray opcional.

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm install
cp .env.example .env
```

## 2. Ejecutar el setup

```bash
npm run setup
```

El setup pregunta si usás Xray y si tenés acceso a la API de Xray Cloud.

Con API:

```env
XRAY_ENABLED=true
XRAY_MODE=api
XRAY_CLIENT_ID=tu_client_id
XRAY_CLIENT_SECRET=tu_client_secret
```

Qat no solicita ni imprime esos secretos durante el setup. Guardalos solamente en `.env` o variables de entorno y validalos con:

```bash
npm run doctor
```

Sin API:

```env
XRAY_ENABLED=true
XRAY_MODE=export
XRAY_EXPORT_FORMAT=csv
```

En modo export, Qat genera archivos importables en `artifacts/`.

## 3. Configurar Jira

En `.env`:

```env
JIRA_BASE_URL=https://tuempresa.atlassian.net
JIRA_EMAIL=tu.email@empresa.com
JIRA_API_TOKEN=tu_token
```

Jira sigue siendo necesario para leer el ticket origen, comentarios, evidencias y vínculos entre issues.

## 4. Configurar ambientes y usuarios

Qat separa **ambiente** y **perfil**.

- Ambiente: dónde probás (`qa`, `staging`, `dev`).
- Perfil: con qué identidad probás (`admin`, `customer`, `readonly`).

La relación es `ambiente/perfil`, por ejemplo `qa/admin`, `qa/customer` o `staging/admin`.

Creá la configuración local:

```bash
mkdir -p .qat
cp .qat/environments.example.json .qat/environments.json
```

Ejemplo:

```json
{
  "environments": {
    "qa": {
      "baseUrl": "https://qa.tuapp.com",
      "defaultProfile": "qa-user",
      "profiles": {
        "qa-user": { "user": "qa.user@empresa.com", "password": "secret" },
        "admin": { "user": "qa.admin@empresa.com", "password": "secret" },
        "customer": { "user": "customer@empresa.com", "password": "secret" }
      }
    },
    "staging": {
      "baseUrl": "https://staging.tuapp.com",
      "defaultProfile": "qa-user",
      "profiles": {
        "qa-user": { "user": "staging.qa@empresa.com", "password": "secret" }
      }
    }
  }
}
```

En `.env` sólo seleccionás la combinación activa:

```env
QAT_ENVIRONMENTS_FILE=.qat/environments.json
QAT_ENV=qa
QAT_PROFILE=admin
```

`.qat/environments.json` y `.env` están ignorados por Git. No copies secretos en tickets, casos, evidencias ni prompts.

Guía detallada: [`ENVIRONMENTS.md`](ENVIRONMENTS.md).

## 5. Cambiar de ambiente o usuario

```bash
npm run qat -- env list
npm run qat -- env show
npm run qat -- env use qa admin
npm run qat -- env use qa customer
npm run qat -- env use staging qa-user
```

`env use` guarda `QAT_ENV` y `QAT_PROFILE` como selección activa. Qat no imprime passwords.

Si no querés usar perfiles todavía, el formato anterior sigue funcionando:

```env
QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
QAT_USER=usuario_qa
QAT_PASSWORD=password_qa
```

## 6. Verificar configuración

```bash
npm run doctor
```

`doctor` informa:

- Claude CLI disponible o no;
- Jira configurado o no;
- modo de Xray;
- si `XRAY_MODE=api`, si Xray Cloud puede autenticarse;
- ambiente y perfil activos;
- URL activa;
- si existen credenciales de prueba.

Nunca muestra passwords, API tokens, client IDs ni client secrets.

Si la API de Xray no autentica, `doctor` recomienda usar temporalmente `XRAY_MODE=export`.

## 7. Usar lenguaje natural

```bash
npm run qat -- "analiza QA-123 y genera casos de prueba"
npm run qat -- "genera los casos de QA-123 y guárdalos"
npm run qat -- "crea los tests de QA-123 en Xray"
npm run qat -- "comenta QA-123 indicando que el smoke pasó correctamente"
npm run qat -- "adjunta ./evidence/error-login.png a QA-123"
```

Qat intenta interpretar localmente pedidos frecuentes para ahorrar tokens y usa Claude como fallback.

## 8. Crear casos en Xray

```bash
npm run qat -- "crea los tests de QA-123 en Xray"
```

### Con `XRAY_MODE=api`

Qat:

1. lee el ticket Jira origen;
2. genera casos estructurados;
3. autentica contra Xray Cloud con `XRAY_CLIENT_ID` y `XRAY_CLIENT_SECRET`;
4. busca Tests existentes usando labels estables de Qat;
5. si no existe, crea un Test mediante la API GraphQL de Xray Cloud;
6. para Tests manuales, envía los pasos y expected results;
7. vincula el Test creado al ticket Jira origen.

Antes de escribir podés usar:

```bash
npm run qat -- xray-sync QA-123 --dry-run
```

En v0.7 los Tests ya existentes se detectan y no se duplican. La actualización completa de sus pasos existentes queda para la próxima iteración.

### Con `XRAY_MODE=export`

Qat genera un archivo importable como:

```text
artifacts/QA-123-xray-import.csv
```

También puede configurarse `XRAY_EXPORT_FORMAT=json`.

## 9. Flujo recomendado por ticket

1. Ejecutá `env show` y confirmá ambiente/perfil.
2. Cambiá de contexto con `env use` si hace falta.
3. Analizá el ticket.
4. Generá casos.
5. Revisá cobertura y ambigüedades.
6. Hacé `xray-sync --dry-run` si usás API.
7. Sincronizá o exportá a Xray.
8. Ejecutá las pruebas.
9. Registrá PASS/FAIL/BLOCKED/TODO.
10. Adjuntá evidencia.
11. Publicá el Test Execution cuando corresponda.

## 10. Registrar una ejecución

Los Test Executions completos todavía usan JSON.

```bash
cp examples/execution.example.json execution.json
npm run qat -- execute QA-123 execution.json --dry-run
npm run qat -- execute QA-123 execution.json
```

Estados permitidos: `PASS`, `FAIL`, `BLOCKED`, `TODO`.

## 11. Seguridad

- `.env` no se sube a Git.
- `.qat/environments.json` no se sube a Git.
- passwords/tokens no se imprimen.
- credenciales de Xray Cloud no se mandan a Claude.
- passwords de prueba no se mandan a Claude.
- evidencias no se mandan al LLM.
- Claude interpreta intención; Qat ejecuta las acciones.
- `--dry-run` permite revisar cambios antes de escribir.

## 12. Ahorro de tokens

Qat intenta reducir llamadas innecesarias al LLM:

- interpretación local cuando es posible;
- caché de generación;
- contexto del ticket limitado;
- secretos fuera del LLM;
- selección de ambientes/perfiles resuelta localmente;
- generación, sync/export y ejecución separados.

## 13. Comandos clásicos

```bash
npm run setup
npm run doctor
npm test
npm run qat -- env list
npm run qat -- env show
npm run qat -- env use qa admin
npm run qat -- generate QA-123 --save
npm run qat -- xray-sync QA-123 --dry-run --save
npm run qat -- xray-sync QA-123
npm run qat -- execute QA-123 execution.json --dry-run
npm run qat -- execute QA-123 execution.json
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
npm run qat -- evidence QA-123 ./evidence/login.png
```

## 14. Problemas comunes

### Claude CLI no aparece

```bash
claude --version
```

Si la empresa usa un wrapper, configurá `CLAUDE_COMMAND`.

### Jira devuelve 401/403

Revisá `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` y permisos.

### Xray Cloud API no autentica

Ejecutá:

```bash
npm run doctor
```

Revisá `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET` y que la API key pertenezca a un usuario con permisos suficientes en Xray/Jira.

Si no podés obtener acceso API, cambiá a:

```env
XRAY_MODE=export
XRAY_EXPORT_FORMAT=csv
```

### No tengo API de Xray

Ejecutá `npm run setup`, indicá que usás Xray y que no tenés API. Qat usará `XRAY_MODE=export`.

### No encuentra el ambiente o perfil

```bash
npm run qat -- env list
```

Revisá `QAT_ENV`, `QAT_PROFILE`, `defaultProfile` y `.qat/environments.json`.

## 15. Próximos pasos

- actualizar completamente los pasos de Tests existentes vía Xray Cloud;
- cambiar ambiente/perfil también por lenguaje natural;
- ejecutar un mismo flujo con varios perfiles/roles;
- resultados y evidencias completamente por lenguaje natural;
- Test Runs nativos de Xray;
- perfiles configurables de importación;
- Test Plans/suites;
- optimización continua de tokens.
