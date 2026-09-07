# Manual de Qat

Este manual explica el flujo diario de Qat sin entrar en detalles internos. La idea es que un QA pueda instalarlo y empezar a usarlo rápidamente.

## 1. Instalar

Requisitos:

- Node.js 18 o superior.
- Claude CLI instalado y autenticado.
- Acceso a Jira Cloud.
- Xray configurado en Jira para las funciones de Tests/Test Executions.

```bash
git clone https://github.com/mnavarrosqa/Qat.git
cd Qat
npm install
cp .env.example .env
```

## 2. Configurar

Abrí `.env` y completá Jira:

```env
JIRA_BASE_URL=https://tuempresa.atlassian.net
JIRA_EMAIL=tu.email@empresa.com
JIRA_API_TOKEN=tu_token
```

Configurá Xray si lo vas a usar:

```env
XRAY_ENABLED=true
XRAY_TEST_ISSUE_TYPE=Test
XRAY_EXECUTION_ISSUE_TYPE=Test Execution
XRAY_LINK_TYPE=Tests
XRAY_EXECUTION_LINK_TYPE=Tests
```

Configurá el ambiente que estás probando:

```env
QAT_ENV=qa
QAT_BASE_URL=https://qa.tuapp.com
QAT_USER=usuario_qa
QAT_PASSWORD=password_qa
```

Usuario/password son opcionales. Nunca commitees `.env` ni copies secretos en casos de prueba.

## 3. Verificar que todo esté listo

```bash
npm run doctor
```

También podés ejecutar los tests internos:

```bash
npm test
```

`doctor` informa si Claude, Jira, Xray y el ambiente están configurados, pero no muestra passwords ni tokens.

## 4. Usar lenguaje natural

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

## 5. Flujo recomendado por ticket

Para `QA-123`:

1. `analiza QA-123 y genera casos de prueba`.
2. Revisá los casos y las ambigüedades detectadas.
3. `sube los tests de QA-123 a Xray sin modificar` para hacer dry-run.
4. `crea los tests de QA-123 en Xray` cuando estés conforme.
5. Ejecutá manualmente los casos.
6. Registrá resultados y evidencia.
7. Publicá el Test Execution.

## 6. Registrar una ejecución

En v0.4 los Test Executions completos todavía usan un JSON para que PASS/FAIL y las evidencias no sean ambiguos.

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

Estados permitidos:

- `PASS`
- `FAIL`
- `BLOCKED`
- `TODO`

Validá primero:

```bash
npm run qat -- execute QA-123 execution.json --dry-run
```

Publicá después:

```bash
npm run qat -- execute QA-123 execution.json
```

Qat crea el Test Execution, vincula los Tests indicados, adjunta evidencia y comenta el ticket origen.

## 7. Cambiar de ambiente

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

## 8. Seguridad

Qat sigue estas reglas:

- `.env` no se sube a Git.
- No imprime passwords ni tokens.
- Las evidencias no se mandan a Claude.
- Los passwords de prueba no se mandan a Claude.
- Claude interpreta intención; no recibe acceso directo a Jira/Xray.
- Para cambios importantes conviene usar dry-run primero.

## 9. Ahorro de tokens

Qat intenta evitar llamadas innecesarias al LLM:

- interpreta localmente instrucciones conocidas;
- cachea generación de casos;
- limita el contexto del ticket;
- no envía binarios ni secretos;
- separa generación, sincronización y ejecución.

## 10. Comandos clásicos

Sirven para CI, debugging o cuando querés una operación totalmente explícita:

```bash
npm run doctor
npm run qat -- generate QA-123 --save
npm run qat -- xray-sync QA-123 --dry-run --save
npm run qat -- xray-sync QA-123
npm run qat -- execute QA-123 execution.json --dry-run
npm run qat -- execute QA-123 execution.json
npm run qat -- comment QA-123 --status passed --summary "Smoke OK"
npm run qat -- evidence QA-123 ./evidence/login.png
```

## 11. Problemas comunes

### Claude CLI no aparece

```bash
claude --version
```

Si la empresa usa un wrapper, configurá `CLAUDE_COMMAND` en `.env`.

### Jira devuelve 401/403

Revisá `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` y los permisos del usuario.

### Xray no crea el tipo correcto

Los nombres dependen de la instalación. Revisá `XRAY_TEST_ISSUE_TYPE`, `XRAY_EXECUTION_ISSUE_TYPE` y los tipos de link.

### No quiero modificar Jira todavía

Usá lenguaje natural indicando `sin modificar` cuando esté soportado o el comando explícito `--dry-run`.

## 12. Qué viene después

La siguiente evolución apunta a poder escribir directamente algo como:

```text
QA-123: TC-001 pasó, TC-002 falló por error 500 y adjunta error.png
```

Qat debería convertirlo en un Test Execution sin necesidad de preparar `execution.json`. Después avanzaremos sobre Test Runs nativos de Xray, detección automática de configuración y Test Plans/suites.
