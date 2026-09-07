# Manual de Qat

Este manual explica el flujo diario de Qat para QA manual.

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

El setup pregunta si usás Xray y si tenés acceso por API.

Con API:

```env
XRAY_ENABLED=true
XRAY_MODE=api
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

## 4. Configurar ambientes y usuarios

Desde v0.6 Qat separa **ambiente** y **perfil**.

- Ambiente: dónde probás (`qa`, `staging`, `dev`).
- Perfil: con qué usuario probás (`admin`, `customer`, `readonly`).

Esto permite usar un mismo ambiente con varios usuarios/passwords o varios ambientes con perfiles distintos.

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
        "qa-user": {
          "user": "qa.user@empresa.com",
          "password": "secret"
        },
        "admin": {
          "user": "qa.admin@empresa.com",
          "password": "secret"
        },
        "customer": {
          "user": "customer@empresa.com",
          "password": "secret"
        }
      }
    },
    "staging": {
      "baseUrl": "https://staging.tuapp.com",
      "defaultProfile": "qa-user",
      "profiles": {
        "qa-user": {
          "user": "staging.qa@empresa.com",
          "password": "secret"
        }
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

`.qat/environments.json` y `.env` están ignorados por Git.

Guía detallada: [`ENVIRONMENTS.md`](ENVIRONMENTS.md).

## 5. Cambiar de ambiente o usuario

Listar configuraciones:

```bash
npm run qat -- env list
```

Ver la selección activa:

```bash
npm run qat -- env show
```

Usar QA como admin:

```bash
npm run qat -- env use qa admin
```

Usar QA como customer:

```bash
npm run qat -- env use qa customer
```

Usar staging:

```bash
npm run qat -- env use staging qa-user
```

Qat no imprime passwords.

### Modo simple

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

- Claude CLI disponible o no.
- Jira configurado o no.
- modo de Xray.
- ambiente activo.
- perfil activo.
- URL activa.
- si existen credenciales de prueba.

Nunca muestra passwords ni tokens.

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

Con `XRAY_MODE=api`, Qat intenta crear/actualizar Tests.

Con `XRAY_MODE=export`, genera un archivo importable como:

```text
artifacts/QA-123-xray-import.csv
```

## 9. Flujo recomendado por ticket

1. Elegí ambiente y perfil.
2. Analizá el ticket.
3. Generá casos.
4. Revisá cobertura y ambigüedades.
5. Sincronizá/exportá a Xray.
6. Ejecutá manualmente.
7. Registrá PASS/FAIL/BLOCKED/TODO.
8. Adjuntá evidencia.
9. Publicá el Test Execution cuando corresponda.

## 10. Registrar una ejecución

En v0.6 los Test Executions completos todavía usan JSON.

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
pm run qat -- evidence QA-123 ./evidence/login.png
```

## 14. Problemas comunes

### Claude CLI no aparece

```bash
claude --version
```

Si la empresa usa un wrapper, configurá `CLAUDE_COMMAND`.

### Jira devuelve 401/403

Revisá `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` y permisos.

### No tengo API de Xray

Ejecutá `npm run setup`, indicá que usás Xray y que no tenés API. Qat usará `XRAY_MODE=export`.

### No encuentra el ambiente

Revisá `QAT_ENV` y los nombres dentro de `.qat/environments.json`.

### No encuentra el perfil

Revisá `QAT_PROFILE` o ejecutá:

```bash
npm run qat -- env list
```

### Quiero un solo ambiente con varios usuarios

Definí sólo `qa` y agregá todos los perfiles necesarios dentro de `qa.profiles`.

## 15. Próximos pasos

- cambiar ambiente/perfil también por lenguaje natural;
- resultados y evidencias completamente por lenguaje natural;
- adapter nativo para Xray Cloud;
- Test Runs nativos de Xray;
- perfiles configurables de importación;
- Test Plans/suites;
- optimización continua de tokens.
