# Cronograma de Charlas SSOMA 2026

Aplicación web estática para programar, ejecutar y evidenciar charlas breves de SSOMA de **noviembre y diciembre de 2026**. No requiere servidor, base de datos ni proceso de compilación; puede publicarse directamente con GitHub Pages.

## Alcance del cronograma

### Noviembre de 2026

- Periodo: **lunes 2 a lunes 30**.
- Frecuencia: **lunes a sábado**, sin domingos.
- Jornadas disponibles: **25**.
- Temas incluidos: **26**.
- Como existen 25 jornadas para 26 temas, el **lunes 30 contiene dos charlas**.

### Diciembre de 2026

- El usuario crea el mes desde el botón **“Crear cronograma de diciembre”**.
- Incluye todos los días de lunes a sábado: **27 jornadas**.
- Programa los 26 temas y usa el 31 de diciembre como refuerzo del tema de reporte oportuno.
- Cada fecha permite cambiar el tema, agregar otra charla, asignar responsable y adjuntar evidencia.

## Funciones principales

- Calendario mensual de lunes a sábado.
- Biblioteca visual con 26 fichas temáticas.
- Descarga individual de cada imagen.
- Selección o cambio del tema de cada fecha.
- Campo de responsable por charla.
- Carga de foto de evidencia desde archivos o cámara del dispositivo.
- Compresión local de evidencias para reducir espacio.
- Estado “Charla cumplida”.
- Búsqueda por tema o responsable.
- Filtros de pendientes, cumplidas, con evidencia o sin responsable.
- Indicadores de avance mensual.
- Exportación a CSV.
- Respaldo e importación en JSON, incluidas las fotos.
- Vista de impresión.
- Funcionamiento sin conexión después de la primera visita mediante service worker.

## Privacidad y almacenamiento

Los responsables, estados y evidencias se guardan **solo en el navegador del usuario**:

- `localStorage`: cronogramas, responsables y estados.
- `IndexedDB`: fotografías de evidencia.

No se envían datos a servicios externos. Borrar los datos del navegador elimina la información local. Para conservarla o transferirla, use **“Descargar respaldo”**.

## Estructura del proyecto

```text
cronograma-ssoma/
├── index.html
├── README.md
├── LICENSE
├── manifest.webmanifest
├── service-worker.js
├── package.json
├── .gitignore
├── .nojekyll
├── tests/
│   └── logic-test.js
└── assets/
    ├── css/
    │   └── styles.css
    ├── js/
    │   ├── data.js
    │   └── app.js
    └── images/
        ├── icon.svg
        └── topics/
            ├── topic-01.webp
            ├── ...
            └── topic-26.webp
```

## Ejecutar localmente

La opción recomendada es servir la carpeta por HTTP:

```bash
cd cronograma-ssoma
python3 -m http.server 8080
```

Luego abra `http://localhost:8080`.

También puede abrir `index.html` directamente. Las funciones básicas operarán, pero la instalación y el modo sin conexión requieren `http://`, `https://` o `localhost`.

### Verificación técnica

Con Node.js instalado, ejecute:

```bash
npm run check
```

Este comando valida la sintaxis y comprueba que noviembre tenga 25 jornadas/26 charlas, que diciembre tenga 27 jornadas y que ninguno de los dos meses incluya domingos.

## Publicar en GitHub Pages

1. Cree un repositorio nuevo en GitHub.
2. Copie el contenido de esta carpeta en la raíz del repositorio.
3. Confirme y suba los archivos:

```bash
git init
git add .
git commit -m "Publicar cronograma SSOMA 2026"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

4. En GitHub, abra **Settings → Pages**.
5. En **Build and deployment**, seleccione **Deploy from a branch**.
6. Seleccione la rama `main` y la carpeta `/ (root)`.
7. Guarde. GitHub mostrará la URL pública cuando termine el despliegue.

## Uso recomendado

1. Abra **Noviembre** y asigne responsables.
2. El día de la charla, abra la ficha y use **Agregar evidencia**.
3. Marque **Charla cumplida**.
4. Exporte el CSV para el seguimiento o descargue un respaldo completo.
5. Seleccione **Diciembre** y pulse **Crear cronograma de diciembre**.
6. Ajuste los temas y responsables según la operación.

## Compatibilidad

Diseñada para versiones actuales de Chrome, Edge, Firefox y Safari en computadoras y dispositivos móviles. La captura directa de cámara depende del navegador y del dispositivo.

## Licencia

MIT. Consulte `LICENSE`.
