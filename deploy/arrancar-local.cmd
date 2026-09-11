@echo off
rem ---------------------------------------------------------------------------
rem  Levanta el CRM local: la base y la pantalla.
rem
rem  POR QUE EXISTE. Augusto, 11/09: «esto no podemos automatizarlo para que se
rem  lance apenas se prenda la computadora?». Sin esto hay que abrir una terminal
rem  y tipear dos comandos cada vez que arranca la maquina, y si uno se olvida el
rem  CRM local no abre — que es exactamente lo que pasa.
rem
rem  Lo lanza la tarea programada «CRM Globalita local» (ver deploy/README.md).
rem  Tambien sirve a mano: doble clic.
rem
rem  ES UN .cmd Y NO UN .ps1 A PROPOSITO. En esta maquina PowerShell tiene la
rem  ejecucion de scripts deshabilitada, asi que un .ps1 no corre. Un .cmd si.
rem
rem  Y SE LLAMA A `node` DIRECTO, no a `npm`. `npm` en Windows es un .ps1 y
rem  falla por la misma politica. Ademas npm resuelve el workspace equivocado
rem  segun desde donde se lo llame.
rem ---------------------------------------------------------------------------

cd /d "%~dp0.."

rem La base. Aplica las migraciones pendientes al arrancar y despues sirve.
start "CRM base" /min node packages\db\dev.mjs

rem La pantalla. Vite se llama directo con node, desde apps\web.
cd apps\web
start "CRM pantalla" /min node ..\..\node_modules\vite\bin\vite.js --port 5173

rem No abre el navegador: la tarea corre al iniciar sesion y una ventana que
rem aparece sola es molesta. El CRM queda en http://localhost:5173/
