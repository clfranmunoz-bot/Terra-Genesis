# Texturas

| Archivo | Origen | Licencia |
|---|---|---|
| `earth_day_8k.jpg` | NASA Visible Earth, *Blue Marble 2002*: `land_shallow_topo_8192.tif` (Stöckli et al., NASA GSFC), convertido a JPEG calidad 88 | Dominio público (NASA) |
| `earth_water_8k.png` | Máscara de agua derivada por color de la misma imagen con `tool/generar_mascara_agua.js` | Dominio público (derivado) |
| Resto (`earth_day.jpg` 4K, `earth_specular.jpg`, etc.) | Texturas originales del proyecto | — |

La versión 8K solo se carga en escritorio con GPU que admita texturas de 8192 px (`js/planet.js`, `usar8K`);
en móviles y tabletas se usan las de 4K/2K para no agotar la memoria gráfica (~170 MB por textura 8K con mipmaps).

Regla de la máscara: agua = píxel azul (océano, lagos) o turquesa (agua somera). Por encima de 60° de latitud solo cuenta
el color exacto del océano (RGB 10, 10, 51), porque el hielo en sombra es azulado. Coincide en un 97,8 % con la máscara 2K anterior;
la diferencia es el detalle costero adicional.
