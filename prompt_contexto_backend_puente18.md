# CONTEXTO DEL PROYECTO — Hackatón Niño San Borja 2026

## Quién soy y qué necesito
Estoy participando en la **Hackatón Niño San Borja 2026**, organizada por el Instituto Nacional de Salud del Niño San Borja (INSNSB), en articulación con la PCM, PUCP y ESAN. Mi equipo (3-5 personas, todos trabajamos en la misma empresa) eligió el **Desafío N°1: "Puente 18+: rediseñando la transición en salud del paciente pediátrico a adulto"**.

Yo estoy a cargo del **backend** de la solución. Necesito que me ayudes específicamente con esa parte (arquitectura, modelado de datos, APIs, seguridad, lógica de negocio). Te paso todo el contexto para que no tengas que preguntarme lo básico.

---

## 1. El desafío que estamos resolviendo

**Enunciado oficial:**
> ¿Cómo podríamos mejorar el proceso de transición de pacientes con enfermedades crónicas, raras o complejas desde la atención pediátrica hacia los servicios de adultos, para que reciban una atención continua y segura, logrando disminuir el riesgo de interrupciones en su seguimiento y tratamiento, así como las brechas de información en pacientes, familias y equipos de salud?

**Nuestra propuesta (idea central):**
Un portal/plataforma de **portabilidad y continuidad de información clínica** para pacientes en transición pediátrico→adulto, que:
- Le da al paciente (o su tutor, mientras es menor) acceso de **solo lectura** a su historial clínico resumido, para poder llevarlo a cualquier centro de salud.
- Modela el **traspaso de titularidad de la autorización de acceso**: mientras el paciente es menor, decide el padre/madre/tutor; al cumplir 18 años, el propio paciente pasa a ser el único titular autorizado.
- Se posiciona como una **capa complementaria al RENHICE** (Registro Nacional de Historias Clínicas Electrónicas del Perú), no como un sistema paralelo o competidor.
- Incluye trazabilidad de accesos, alertas de continuidad de tratamiento, y un resumen clínico portable (tipo "ficha de transición" con diagnósticos, medicación, alergias, cirugías previas).

---

## 2. Marco legal peruano que debe respetar el backend

Estoy basando el diseño en la **Norma Técnica de Salud N° 139-MINSA/2018/DGAIN** (RM 214-2018-MINSA, "Gestión de la Historia Clínica"). Puntos clave que el backend debe reflejar:

- **Propiedad**: la Historia Clínica física/base de datos es de la IPRESS (centro de salud); pero **la información clínica es propiedad del paciente** (Ley 26842).
- **Derecho de copia**: el paciente tiene derecho a copia de su HC/Epicrisis en máx. 5 días (48h si es urgente). La Epicrisis es siempre gratuita.
- **Datos sensibles**: la info clínica es "dato sensible" según Ley 29733 (Protección de Datos Personales) → requiere consentimiento explícito para tratarse, salvo excepciones legales (ej. emergencia con riesgo de vida, vía RENHICE).
- **Información clínica básica** (alergias, diagnósticos previos, medicación, cirugías, grupo sanguíneo) puede ser accedida por personal de salud en emergencias **sin autorización previa** del paciente si su vida está en riesgo.
- **Información clínica sensible** (VIH, salud sexual, genética, etc.) **siempre** requiere autorización expresa.
- **Menores de edad**: la autorización de acceso la da el padre/madre/tutor. Al cumplir 18 años, el paciente se convierte en el único titular.
- **Seguridad exigida por norma** para Historia Clínica Electrónica: autenticidad, confidencialidad, integridad, disponibilidad, trazabilidad (quién accedió, cuándo, con qué credenciales).

**Importante para el backend**: como esto es un prototipo de hackatón, **no debemos usar datos reales de pacientes**. Todo debe funcionar con datos ficticios/sintéticos (esto es una condición obligatoria de las bases del hackatón, ver punto 4).

---

## 3. Alcance esperado del prototipo (no producción real)

Este es un **prototipo de hackatón**, no un sistema en producción. Debe:
- Ser funcional y demostrable (no necesita estar 100% terminado, pero sí mostrar el flujo completo).
- Usar datos sintéticos/ficticios (nunca datos reales de pacientes).
- Estar construido con componentes de **código abierto** (obligatorio, ver sección 4) y publicado en un repositorio público al final.
- No requiere validación clínica oficial ni integración real con RENHICE — puede simularse/mockearse esa integración.

**Funcionalidades mínimas que probablemente necesitaré del backend:**
1. Registro/autenticación de usuarios (paciente/tutor, y personal de salud) con roles distintos.
2. Modelo de datos para: paciente, tutor legal, historial clínico resumido (diagnósticos, medicación, alergias, cirugías, exámenes clave), autorizaciones de acceso, y bitácora de accesos (trazabilidad).
3. Lógica de "traspaso de titularidad" automático o semi-automático cuando el paciente cumple 18 años (cambia quién puede autorizar/gestionar accesos).
4. API para que un centro de salud (simulado) consulte el resumen clínico del paciente, con registro de quién accedió y cuándo.
5. Manejo de consentimiento: distinguir entre "información clínica básica" (accesible en emergencia) e "información clínica sensible" (requiere autorización explícita).
6. Exportar/generar un resumen tipo "ficha de transición" (PDF o similar) para que el paciente lo lleve físicamente si lo necesita.

---

## 4. Reglas del Hackatón que afectan el desarrollo técnico

- **Propiedad intelectual**: el equipo mantiene los derechos, pero el código/componentes deben publicarse bajo **licencia abierta** (uso, adaptación, redistribución permitidos, con reconocimiento de autoría).
- **No se permite el uso de datos personales reales, información confidencial ni credenciales institucionales.**
- **Entregables finales que dependen del backend**: 
  - Prototipo o demo funcional.
  - Repositorio de código público con documentación básica de uso.
  - Si se usó IA generativa (probable, ya que te estoy consultando a ti), debo declarar su uso en un anexo (herramienta, propósito, qué se revisó/incorporó).
- **Criterios de evaluación del jurado** (rúbrica ponderada) — el backend impacta directamente en:
  - Viabilidad técnica y económica (20%): que la arquitectura sea realista, no sobre-diseñada, implementable en el tiempo de un hackatón.
  - Impacto en salud (25%): que el modelo de datos y flujos realmente resuelvan el problema de continuidad/discontinuidad de información en la transición 18+.
  - Enfoque en el usuario (20%): pensar en accesibilidad para pacientes con enfermedades crónicas/raras y sus familias, muchas veces con poca alfabetización digital.

---

## 5. Lo que quiero que hagas (tu rol en esta conversación)

Ayúdame con decisiones y desarrollo de **backend**: arquitectura, elección de stack (algo simple y rápido de implementar en tiempo de hackatón), modelado de base de datos, diseño de endpoints/API, lógica de autenticación y roles, manejo de consentimiento/trazabilidad, y buenas prácticas de seguridad aplicables a datos de salud — todo a nivel de prototipo demostrable, no de sistema en producción certificado.

Cuando te pregunte algo específico de código o arquitectura, ya tienes todo el contexto de negocio, legal y de reglas del evento para darme respuestas alineadas a lo que necesito entregar.
