Lix Design v1.6
One design language for every Lixby experience.

Filosofía
Lix Design es el sistema de diseño oficial del ecosistema Lixby.
Su objetivo es crear una experiencia coherente, premium, fluida y reconocible en todas las aplicaciones, dispositivos, servicios y productos de la marca.
Lix Design no es simplemente una guía visual. Es un sistema unificado de diseño, interacción y desarrollo que define cómo debe verse, sentirse y comportarse cualquier experiencia creada dentro del ecosistema Lixby.
La identidad visual se basa en cinco pilares:
Minimalismo
Liquid Glass
Azul Lixby
Fondos Aurora
Espacios amplios
Una interfaz de Lix Design debe transmitir:
Calma. Claridad. Tecnología. Fluidez. Calidad premium.

Principios
Principio
Descripción
Consistencia
Los mismos patrones funcionan igual en todas las experiencias
Simplicidad
Solo existe lo necesario; nada decorativo sin propósito
Rapidez
Las interacciones deben sentirse inmediatas
Fluidez
Las transiciones conectan estados sin romper la experiencia
Accesibilidad
WCAG 2.1 AA como mínimo
Continuidad
El usuario nunca debe sentirse perdido
Elegancia
Cada detalle debe transmitir calidad premium


Color System
Brand
Token
Valor
Uso
Primary 700
#113EFF
Pressed, estados intensos
Primary 600
#3462FF
Hover principal
Primary 500
#0F3DFF
Color principal Lixby (Azul Lixby)
Primary 400
#3284FF
Hover secundario
Primary 300
#16A7FF
Acentos suaves y degradado oficial
Primary 100
#B4CAFB
Disabled y fondos suaves

Primary 500 (#0F3DFF) es el Azul Lixby oficial.
Se combina con Primary 300 (#16A7FF) para el degradado oficial.

Backgrounds
Token
Valor
Uso
Background Primary
#F6F8FB
Fondo principal
Background Blue
#B2C8FC
Aurora
Background Light
#C9E3FC
Aurora
Background Soft
#CFE9FC
Aurora


Neutrals
Token
Valor
Uso
Text Primary
#131A28
Texto principal
Text Secondary
#697380
Descripciones
Line Subtle
rgba(15, 61, 255, 0.08)
Bordes suaves, separadores tenues
Line
#DBE3EF
Borde estándar
Line Strong
#B2B8BE
Bordes enfáticos
Surface
#FFFFFF
Superficies


Background System
Fondo principal
#F6F8FB

Footer Tokens
Token
Valor
Uso
Footer Background
#EEF2F7
Fondo del footer
Footer Text Strong
#061438
Títulos del footer
Footer Text Mid
#5F6B7A
Enlaces y texto secundario
Footer Text Soft
#8A94A6
Texto terciario

Aurora Background
Los fondos de Lix Design nunca deben sentirse completamente planos.
El sistema Aurora utiliza gradientes suaves, manchas desenfocadas y profundidad visual sutil.
Gradiente oficial
#B2C8FC → #C9E3FC → #CFE9FC → #F6F8FB

Principios
Gradientes suaves
Sin contrastes agresivos
Orbs desenfocados
Movimiento extremadamente lento opcional
El contenido siempre debe mantener prioridad visual

Design Tokens
Espaciado
Todo el sistema utiliza una escala consistente.
4
8
12
16
24
32
40
48
64
96
128

La base principal del sistema es múltiplo de 8.

Border Radius
8
12
16
20
24
28
32
Full (9999px)

Regla
Lix Design utiliza radios generosos.
El uso habitual es:
Componentes pequeños: 12–16 px
Inputs estándar: 12 px
Inputs grandes / búsqueda: 16 px
Búsqueda pill y botones: Full
Cards: 24 px
Paneles: 28 px
Modales: 32 px

Shadows
Las sombras utilizan un ligero tinte azul.
Token
Valor
Small / Card
0 4px 16px rgba(15, 61, 255, 0.08)
Medium
0 12px 28px rgba(15, 61, 255, 0.08)
Large
0 20px 50px rgba(15, 61, 255, 0.12)
XL
0 30px 70px rgba(15, 61, 255, 0.18)

Las cards descansan sobre Small/Card y elevan a Medium al hacer hover.
Las sombras nunca deben sentirse pesadas o negras.

Motion Tokens
Token
Duración
Fast
150 ms
Normal
250 ms
Slow
400 ms

Curva oficial
cubic-bezier(0.22, 1, 0.36, 1)


Motion Ambient
Las animaciones ambientales (fondos Aurora, orbs, elementos flotantes) utilizan duraciones largas independientes del sistema UI.
Token
Duración
Ambient
6 s (rango 4–8 s)
Ambient Slow
9 s


Typography
Fuente oficial
Inter
Toda la interfaz utiliza Inter.

Pesos
Peso
Valor
Regular
400
Medium
500
SemiBold
600
Bold
700
ExtraBold
800
Display, títulos de hero


Escala tipográfica
Token
Tamaño
XS
12 px
SM
14 px
MD
16 px
LG
20 px
XL
32 px
2XL
48 px
3XL
64 px

Reglas
Títulos: SemiBold, Bold o ExtraBold (800) en display
Texto principal: 16 px
Texto secundario mínimo: 14 px
Nunca utilizar tamaños inferiores a 12 px

Liquid Glass
Liquid Glass es uno de los elementos más distintivos de Lix Design.
Tokens Light
Token
Valor
Background
rgba(255,255,255,.72)
Border
rgba(255,255,255,.55)
Blur
30 px

Características
Transparencia
Blur
Profundidad
Bordes suaves
Sombras ligeras
Capas visuales
Regla
Liquid Glass debe utilizarse cuando exista una jerarquía de profundidad.
No debe utilizarse simplemente como decoración.

Layout & Grid
Sistema
12 columnas

Márgenes
Dispositivo
Margen
Desktop
32 px
Tablet
24 px
Mobile
16 px


Contenedores
Nombre
Ancho máximo
Compact
768 px
Medium
1024 px
Wide
1280 px
Full
1440 px


Espaciado entre secciones
16
24
48
64
96


Responsive System
Breakpoints oficiales
Nombre
Rango
Mobile
0–639 px
Tablet
640–1023 px
Desktop
1024–1279 px
Wide
1280 px+


Comportamiento
Mobile
Una columna
Sidebar como drawer
Navegación simplificada
Acciones prioritarias visibles
Tablet
Dos columnas cuando sea posible
Paneles adaptativos
Desktop
Sidebar fija
Workspace completo
Mayor densidad de información
Wide
Paneles amplios
Mayor espacio negativo
Container máximo de 1440 px

Components
Button
Estándar
Altura: 48 px
Radius: Full
Padding: 16 × 24 px
Font Weight: 700
Transition: 250 ms

Primary
Fondo: linear-gradient(135deg, #0F3DFF → #16A7FF)
Texto: Blanco
Borde: ninguno
Estados
Estado
Estilo
Default
Degradado oficial #0F3DFF → #16A7FF
Hover
#3462FF → #16A7FF
Pressed
#113EFF → #16A7FF + scale(0.99)
Disabled
#B4CAFB


Secondary
Fondo blanco
Borde suave
Texto oscuro
Hover:
Background: #F6F8FB


Ghost
Sin fondo
Texto azul
Hover:
rgba(45,123,255,.08)


Regla principal
Solo existe un botón primario dominante por sección o contexto visual; pueden coexistir varios primarios en secciones diferentes de una misma página.

Input
Estándar
Altura: 48 px
Radius: 12 px (grandes y búsqueda: 16 px; búsqueda pill: Full)
Padding: 12 × 16 px
Inter 16 px

Estados
Default
Fondo blanco
Texto oscuro
Borde neutro
Focus
Borde Azul Lixby
Halo azul
Sombra suave
Error
Borde rojo
Halo rojo suave
Mensaje claro debajo del input
Success
Borde verde
Check visual
Disabled
Fondo suave
Sin interacción

Card
Estándar
Padding: 24 px
Radius: 24 px
Fondo blanco o Liquid Glass
Borde suave
Sombra Small (--shadow-card)
Transition: 250 ms

Hover
transform: translateY(-4px);
Sombra Medium (0 12px 28px rgba(15, 61, 255, 0.08))

La sombra aumenta progresivamente.

Tipos
Product Card
App Card
Dashboard Card
Feature Card
Glass Card
Media Card
Action Card
Las cards siempre deben sentirse como superficies flotantes sobre el fondo.

Navigation
LixNavbar
ID: LIX-NAV-001
Especificaciones
Altura: 64 px
Radius: 32 px
Margen superior: 16 px
Max Width: 1280 px
Estilo
Flotante
Liquid Glass
Blur
Sombra suave
Estructura
Logo → Navigation → Actions → Profile

Variantes
Default
Compact
Transparent
Dark

LixSidebar
ID: LIX-NAV-002
Especificaciones
Ancho: 280 px
Compact: 88 px
Radius: 28 px
Padding: 20 px
Elemento activo
Fondo azul suave
Icono Azul Lixby
Texto principal
Variantes
Default
Compact
Expanded
Dark

Tabs
Altura: 40 px
Radius: Full
Gap: 4 px
Las tabs deben permitir cambiar de contexto sin romper la continuidad visual.

LixCommandPalette
ID: LIX-NAV-003
Especificaciones
Ancho: 720 px
Radius: 32 px
Atajo oficial
⌘K / Ctrl+K

Funciones
Buscar aplicaciones
Buscar proyectos
Buscar archivos
Ejecutar acciones
Navegar por el sistema
Controlar Maikol
La Command Palette es el centro universal de comandos del ecosistema Lixby.

Motion
Filosofía
Las animaciones deben sentirse naturales e invisibles.
Nunca deben existir únicamente para decorar.
Su objetivo es explicar:
Qué ha cambiado
Dónde aparece algo
Qué elemento tiene prioridad
Cómo se relacionan dos estados

Animaciones base
Animación
Descripción
Lift
Elevación + sombra
Fade
Opacidad
Scale
0.96 → 1
Slide
±16 px → 0
Blur
Desenfoque → claridad


Interacciones
Todos los componentes interactivos deben contemplar:
Default
Hover
Focus
Active
Disabled
Loading
Cada acción debe recibir una respuesta visual inmediata.

Page Transition
Fade + Slide
250 ms

Modal
Fade + Scale
250 ms

Dropdown
Fade + Translate
150 ms


Dark Mode
Lix Design debe funcionar como un sistema completo en modo oscuro, no simplemente invertir colores.
Backgrounds
Token
Valor
Primary
#0E1422
Secondary
#131A28
Elevated
#182133
Soft
#1D2940


Text
Token
Valor
Primary
#F5F8FF
Secondary
#A7B4C8
Tertiary
#7F8A9C


Dark Glass
Fondo oscuro translúcido
Blur 32 px
Borde azul extremadamente suave
background: rgba(14,20,34,.72);
border: 1px solid rgba(50,120,255,.15);
backdrop-filter: blur(32px);


Iconography
Estilo
Lineal
Redondeado
Geométrico
Minimalista
Grosor
2 px
Tamaño estándar
18 px
Estados
Estado
Color
Principal
Azul Lixby
Secundario
Gris
Activo
Azul intenso
Disabled
Azul suave

Los iconos deben comunicar acciones de forma clara incluso sin texto cuando sea necesario.

Visual Language
Ilustraciones
Colores suaves
Azul Lixby
Gradientes
Formas redondeadas
Profundidad ligera

Imágenes
Radius: 24 px
Espacio amplio alrededor
Sombras suaves
Nunca saturar visualmente la interfaz

Data Visualization
Los gráficos utilizan:
Líneas redondeadas
Azul Lixby como color principal
Fondos suaves
Grid discreto
Animaciones mínimas

Accessibility
Contraste
Elemento
Mínimo
Texto principal
4.5:1
Texto secundario
3:1

Objetivo general:
WCAG 2.1 AA

Tamaños mínimos
Texto: 14 px
Iconos: 16 px

Área táctil
44 × 44 px mínimo

Para todos los elementos interactivos.

Focus
El focus visible es obligatorio.
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(45,123,255,.4);
}


Navegación por teclado
Debe funcionar con:
Tab
Shift + Tab
Enter
Space
Escape
Flechas

Reduced Motion
La interfaz debe respetar:
prefers-reduced-motion

Las animaciones deben reducirse o eliminarse automáticamente.

Validation
Error
Borde rojo
Halo suave
Mensaje claro
Nunca depender únicamente del color
Success
Borde verde
Check visual
Feedback claro
La validación aparece después de la interacción del usuario.
Nunca se debe mostrar un error antes de que el usuario tenga oportunidad de completar una acción.

Feedback
LixToast
ID: LIX-FBK-001
Especificaciones
Ancho: 360 px
Radius: 24 px
Duraciones
Tipo
Duración
Success
3 s
Info
4 s
Warning
5 s
Error
Manual

Posición
Esquina superior derecha.
Variantes
Success
Info
Warning
Error

LixNotificationCenter
ID: LIX-FBK-002
Panel lateral
Ancho: 380 px
Radius: 28 px
Sincronización entre dispositivos cuando sea posible

Loading
LixSkeleton
Lix Design utiliza Skeleton Loading como sistema principal.
Características:
Forma similar al contenido final
Shimmer sutil
Sin animaciones agresivas
Transición suave al contenido real

Empty States
Todos los estados vacíos incluyen:
Icono
Título
Descripción
Acción principal
Nunca debe existir una pantalla vacía sin contexto.

Professional Workspace
LixWorkspace
ID: LIX-LAY-001
Arquitectura oficial para aplicaciones profesionales.
Navbar
├── Sidebar
├── Explorer
├── Workspace
├── Inspector
└── Timeline

Todos los paneles utilizan:
Radius 28 px
Liquid Glass cuando exista profundidad
Gap 16 px
Sombras suaves

LixExplorer
ID: LIX-LAY-003
Ancho
260 px
Funciones
Proyectos
Archivos
Assets
Favoritos
Búsqueda
Drag & Drop

LixInspector
ID: LIX-LAY-002
Ancho
320 px
Secciones
Transform
Appearance
Typography
Effects
Audio
Export
El Inspector es contextual y solo muestra información relevante al elemento seleccionado.

LixTimeline
ID: LIX-DAT-002
Altura
220 px
Soporta
Vídeo
Audio
Imagen
Texto
Efectos
El Playhead oficial utiliza el Azul Lixby.

Data Display
LixTable
ID: LIX-DAT-001
Especificaciones
Altura de fila: 56 px
Radius: 24 px
Siempre dentro de una LixCard
Funciones
Búsqueda
Ordenación
Selección
Paginación

Surface Components
LixModal
ID: LIX-SUR-001
Especificaciones
Ancho estándar: 560 px
Radius: 32 px
Estructura
Header
Description
Content
Footer

Animación
Fade + Scale
250 ms

Overlay
Blur
Oscurecimiento ligero
Click exterior configurable

Surface Components
LixFAQ
ID: LIX-SUR-002
Acordeón de preguntas frecuentes de la web de Lixby.
Estructura
faq (contenedor raíz, puede coincidir con faq-list o faq-section)
├── faq-list
│   ├── faq-item
│   │   ├── faq-question (button)
│   │   ├── faq-chevron (SVG)
│   │   └── faq-answer
│   │       └── faq-answer-text (p)
│   └── ...
Marca clave
El contenedor debe incluir la clase .faq como ancestro del acordeón:
<section class="faq faq-section">
<div class="faq faq-list">
sin esa clase, respuestas ocultas por la regla general .faq-answer.

Especificaciones
faq-item
Fondo blanco
Radius: 20 px
Sombra cerrado: 0 2px 8px rgba(15, 61, 255, 0.06)
Sombra abierto (.open): 0 12px 28px rgba(15, 61, 255, 0.08)
Overflow: hidden
Ancho máximo: 720 px (768 px si faq-section)
faq-question
Button de ancho completo, text-align izquierda
Padding: 20 × 28 px
font-size: 18 px, weight 600
Icono: faq-chevron SVG 22 px, rota 180° al abrir
Hover: color Azul Lixby
faq-answer
max-height: 0 → altura real
Overflow hidden
Transición: max-height 250 ms cubic-bezier(.22, 1, .36, 1)
faq-answer-text
Padding: 14 px 28 px 24 px
font-size: 16 px, color muted, line-height 1.8

Estados y comportamiento
Cada faq-item sigue el patrón accesible:
button.faq-question con aria-expanded="false" → "true"
apertura: max-height 0 → scrollHeight 250 ms
una única pregunta abierta por lista (acordeón exclusivo)
teclado: Tab, Enter, Space
elementos con id + aria-controls + role="region"

Reglas
La respuesta nunca depende de display:none global: se controla con max-height + overflow hidden.
Toda la lista usa el mismo sistema de tokens (radius, sombra azul, motion oficial).

Web Components
Componentes documentados de las páginas actuales de lixby.es.

LixNavbar Web
ID: LIX-WEB-001
Navbar real de la web (difiere de LixNavbar flotante v1.5).
Altura: 64 px
Fijo a top, z-index alto
Fondo: rgba(255,255,255,.95)
Backdrop-filter: blur(16px) saturate(170%)
Borde inferior: 1px #e6e7eb
Estructura: brand → links → acciones (búsqueda, cesta, cuenta, menú)
Enlace con subrayado degradado animado (0 → 100%, Azul Lixby)
Colapsa al scroll (.nav-scrolled)

Variantes
Default
Search (con input pill)
Mobile (panel deslizante nav-mobile-panel)

LixProductSubnav
ID: LIX-WEB-002
Subnavegación de producto.
Ancho máximo: 1120 px
Título + badge "Nuevo" (azul #0B5FFF, uppercase)
Enlaces de anclaje (Descripción, Especificaciones…)
CTA pill oscura (.buy-pill, radius Full, negro)

LixHeaderHero
Idioma web: hero genérico con eyebrow.
Estructura: .eyebrow (label) + h1 + texto + acciones
Grid: 1.1fr / 0.9fr
Solo un botón primario dominante.

LixHeroVariants
Shop Hero: 1.2fr / 1fr, align-items end, h1 clamp(2.2rem, 5rem) letter-spacing -.04em
Support/Help Hero: gradiente 135deg #0F4C81 → #1A7CC0 → #6CC4FF; badge de estado
Product Hero: .hero-card, .hero-price (1.6rem, 800), .hero-tag pills

LixTab
ID: LIX-WEB-003
Tabs con pestañas de color e interacción.
Uso: selección de variante / color en página de compra
Estado [aria-pressed="true"]: fondo blanco / texto negro
Adaptable a estado de color visual (dot del color seleccionado)

LixProductCard
ID: LIX-WEB-004
Tarjeta de producto del store.
Radius: 28 px
Padding: 30 px
min-height: 430 px
Glass blur 30 px
Eyebrow uppercase (1.2em – 1.4em en casas de producto)
Imagen: 230 px, object-fit: contain, sombra 0 18px 45px rgba(0,0,0,.2)
Hover: elevate 4 px + sombra Medium

LixShopCategory
ID: LIX-WEB-005
Tarjeta de categoría de tienda.
Radius: 20 px
Centrada, glass pill
Icono 88 × 88 radius 18 px
Hover: translateY(-4px) + sombra Medium

LixTrustCard
ID: LIX-WEB-006
Tarjeta de confianza (envíos, garantía, soporte).
Radius: 20 px
Padding: 28 × 24 px
Glass
Icono 44 × 44 radius 14 px
flex: 0 0 calc(33.33% - 15px)

LixStatCard
ID: LIX-WEB-007
Tarjeta de estadísticas con contador animado (data-target).
ancestros: content-align, animado al entrar en viewport.

LixTestimonialCard
ID: LIX-WEB-008
Tarjeta de testimonio.
Variante destacada: padding 32 px, texto 1.25rem, comillas
Variante estándar: padding 24 px + meta (nombre, tag) + estrellas ámbar #F5A623

LixMediaBlock
ID: LIX-WEB-009
Bloque de media (vídeo/pantalla).
Radius: 26 px
Overflow hidden
min-height: 360 px
Media object-fit cover opacidad .8

LixAccountCard
ID: LIX-WEB-010
Tarjeta de autenticación / cuenta.
Fondo blanco, borde --line
Radius: 22 px
Padding: 24 px
Sombra suave

LixThankYouCard
ID: LIX-WEB-011
Confirmación de pedido.
max-width: 680 px
Radius: 20 px
Success icon 72 px verde #458500 con check animado + confeti
Order badge: pill verde claro radius Full

LixAuthStatus
ID: LIX-WEB-012
Avisos de estado en flujos de cuenta.
Variantes
Info: #EFF6FF / texto #1D4ED8 / borde #BFDBFE
Error: #FEF2F2 / texto #B91C1C / borde #FECACA
Success: #ECFDF5 / texto #047857 / borde #A7F3D0
Radius: 12 px, padding 10 × 12 px, peso 600

LixStatusDot
ID: LIX-WEB-013
Indicador de estado en vivo (soporte / beta).
10 px, verde #34D399
Glow: box-shadow 0 0 0 6px rgba(52,211,153,.18)

LixCompareTable
ID: LIX-WEB-014
Tabla comparativa de producto.
Header: 1fr 1px 1fr, columna destacada #F4F6FB
Check verde #22C55E / cross gris #9CA3AF
Columna destacada peso 600

LixServiceCard
ID: LIX-WEB-015
Tarjetas de servicio/extras (Care, garantía ampliada).
Radius: 16–18 px
Detalles nativos <details> con cuerpo animado max-height 0 → 500 px
Borde acento al abrir ([open])

LixDarkSection
ID: LIX-WEB-016
Secciones oscuras para producto (ANC, Fit, Case, Battery).
Fondo: #0B0B0C / #0F172A
Cards: rgba(255,255,255,.04), radius 16 px
Toggles glass + dots de estado
Barras animadas (waves), valores grandes 800 (ej. IPX 6, 60 h)

LixPageStatus404
ID: LIX-WEB-017
Página 404.
Hero centrado + búsqueda pill (radius Full)
Íconos orbs ambientales (aurora)
Acción primaria con degradado Azul Lixby

Web Utils
LixScrollProgress
Barra de progreso fija superior (0 → 100% según scroll).
LixBackgroundOrb
Manchas ambientales blur (orb-1…5), aria-hidden, extras en hero.
LixReveal
Reveal on scroll: opacidad + translateY(30px) → 0; clases .reveal / .reveal.in-view; soporta data-delay.
LixFloatAnimation
Animación de flotación para imágenes de producto (hero).

Web Validation & Feedback
Los flujos web actuales utilizan:
auth-status (para errores/éxitos en cuenta)
mensajes de error bajo input en compra
spinner/disabled durante submit
Los mismos tokens de validation que la sección Validation.

Component Rules
Todos los componentes de Lix Design comparten:
Inter
Radius alto
Espaciado basado en tokens
Sombras oficiales
Motion oficial
Estados completos
Focus visible
Área táctil mínima
Responsive
Accesibilidad
Ningún componente puede crear estilos propios fuera del sistema sin ser aprobado e incorporado previamente a Lix Design.

Arquitectura de Desarrollo
React
Paquete oficial:
@lix/design


Sistema de Tokens
La arquitectura utiliza tres niveles:
Design Tokens
    ↓
Theme Tokens
    ↓
Component Tokens

Design Tokens
Valores base:
Colores
Espaciado
Radius
Sombras
Tipografía
Motion
Theme Tokens
Adaptan el sistema a:
Light Mode
Dark Mode
Futuras variantes
Component Tokens
Definen valores específicos de cada componente.
Ejemplo:
--button-primary-background
--button-primary-hover
--card-radius
--navbar-background


CSS Architecture
El sistema utiliza:
CSS Variables
Design Tokens
Theme Tokens
Component Tokens
Nunca deben existir valores visuales repetidos directamente dentro de componentes cuando existe un token correspondiente.

Figma Architecture
Un único archivo oficial de Lix Design.
Pages
Foundations
Tokens
Components
Patterns
Templates
Mobile
Desktop
Dark Mode
Todos los componentes deben utilizar:
Auto Layout
Variables
Component Properties
Variants

Versioning
Lix Design utiliza versionado semántico simplificado:
v1.0
v1.1
v1.2
v1.3
v1.4
v1.5

Una nueva versión debe documentar:
Cambios visuales
Nuevos componentes
Tokens añadidos
Cambios incompatibles
Componentes deprecated

Design Principles Checklist
Antes de aprobar una interfaz:
Utiliza colores oficiales
Utiliza Inter
Respeta los tokens de espaciado
Utiliza radius oficiales
Utiliza sombras oficiales
Incluye todos los estados necesarios
Tiene Focus visible
Cumple contraste mínimo
Respeta Motion oficial
Funciona en Responsive
Mantiene áreas táctiles de 44×44 px
Utiliza Liquid Glass correctamente
No crea estilos fuera del sistema
Prioriza contenido sobre decoración

Lix Design Rules
Solo existe un botón primario dominante por sección.
Todos los componentes utilizan tokens.
Radius alto por defecto.
Espaciado basado en múltiplos de 8.
La duración estándar de animación es 250 ms.
Liquid Glass se utiliza para comunicar profundidad.
Ningún panel toca directamente los bordes de pantalla.
El contenido siempre tiene prioridad.
Los paneles deben sentirse flotantes.
Focus visible obligatorio.
Área táctil mínima de 44×44 px.
Todo nuevo componente debe añadirse a Lix Design antes de utilizarse.
Ninguna aplicación puede modificar arbitrariamente los tokens globales.
Light Mode y Dark Mode deben mantener la misma identidad visual.
La accesibilidad forma parte del componente desde su creación.

Firma de Lix Design
Una interfaz de Lix Design se reconoce por la combinación de:
Inter
Azul Lixby
Degradado Azul Lixby
Fondos Aurora
Liquid Glass
Bordes generosos de 24–32 px
Iconos lineales de 2 px
Espacios amplios
Paneles flotantes
Sombras con tinte azul
Animaciones de 250 ms
Focus azul visible
Dark Mode coherente

Changelog
v1.6
Web Components
Nueva categoría de componentes reales de la web lixby.es.
Añadido LixFAQ (acordeón de preguntas frecuentes) con estructura, estados y reglas de accesibilidad.
Añadidos componentes web documentados: LixNavbar Web, LixProductSubnav, LixHeaderHero, variantes de hero, LixTab, LixProductCard, LixShopCategory, LixTrustCard, LixStatCard, LixTestimonialCard, LixMediaBlock, LixAccountCard, LixThankYouCard, LixAuthStatus, LixStatusDot, LixCompareTable, LixServiceCard, LixDarkSection, LixPageStatus404.
Web Utils
Añadidos LixScrollProgress, LixBackgroundOrb, LixReveal y LixFloatAnimation.
Notas
La documentación de componentes web se alinea con los tokens v1.5 (Azul Lixby #0F3DFF, liquid glass, sombras azules, motion 250 ms).
v1.5
Tiene como base la v1.4 y la estética ya utilizada en la web de Lixby.
Color
Azul Lixby oficial actualizado a #0F3DFF.
Hover #3462FF, Pressed #113EFF, Acento #16A7FF.
Fondo principal #F6F8FB.
Añadido degradado oficial en botones primarios: linear-gradient(135deg, #0F3DFF → #16A7FF).
Tokens
Añadidos Line Subtle rgba(15,61,255,.08), Line #DBE3EF y Line Strong #B2B8BE.
Añadido --shadow-card (Small) 0 4px 16px rgba(15,61,255,.08).
Añadido radio 12 px a la escala.
Añadido 128 px a la escala de espaciado.
Añadidos tokens de Footer (#EEF2F7, #061438, #5F6B7A, #8A94A6).
Añadido Motion Ambient 4–8 s.
Typography
Añadido Inter 800 (ExtraBold) para display.
Iconography
Iconos lineales a 18 px con trazo de 2 px.
Components
Botones primarios: degradado azul oficial y sin borde.
Inputs: 12 px estándar, 16 px grandes, Full en búsqueda pill.
Cards: sombra Small (--shadow-card) y Medium en hover.
Regla de botón primario revisada: uno dominante por sección, no por pantalla.
Notas
La aplicación del contenedor 1280 px, navbar superior a 16 px y footer tokenizado queda pendiente de nueva iteración en la web.

v1.4
Design System
Reestructurado el sistema completo como documentación técnica oficial.
Añadido sistema de tokens organizado en Design Tokens, Theme Tokens y Component Tokens.
Añadidos breakpoints oficiales.
Añadidos containers oficiales.
Añadido sistema formal de sombras.
Añadida curva de animación oficial.
Mejorado el sistema Aurora.
Components
Mejorados Button, Input y Card.
Añadidos estados completos.
Añadido sistema de validación.
Añadido LixSidebar.
Añadido LixCommandPalette.
Añadido LixToast.
Añadido LixNotificationCenter.
Añadido LixSkeleton.
Añadido LixModal.
Añadido LixTable.
Professional Workspace
Añadido LixWorkspace.
Añadido LixExplorer.
Añadido LixInspector.
Añadido LixTimeline.
Accessibility
Focus visible obligatorio.
Área táctil mínima de 44×44 px.
Navegación por teclado.
Reduced Motion.
WCAG 2.1 AA como objetivo mínimo.
Architecture
Definida arquitectura oficial para React.
Definida arquitectura de tokens.
Definida estructura oficial de Figma.
Añadido sistema de versionado.

v1.3
Versión inicial del sistema de diseño.

Lix Design v1.6
One design language for every Lixby experience.
Lix Design v1.6 establece una base visual, técnica y de interacción unificada para todo el ecosistema Lixby.
No define únicamente cómo deben verse las interfaces.
Define cómo deben sentirse.
Calm. Clear. Fluid. Premium. Lixby.