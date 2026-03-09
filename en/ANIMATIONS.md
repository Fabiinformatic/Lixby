<<<<<<< HEAD
# 🎬 Complete Animation Guide - Lixby (20 Animations)

Documentación completa de las 20 animaciones implementadas en el proyecto Lixby.

---

## ✅ Animaciones Implementadas

### 1️⃣ Fade-in de secciones
**Clase CSS:** `.fade-in-up`  
**Uso:** Aplicar a cualquier sección que deba aparecer con fade-in.

```html
<section class="fade-in-up">
  <h2>Contenido con fade-in</h2>
</section>
```

**Duración:** 0.8s | **Easing:** ease-out

---

### 2️⃣ Cards con efecto hover lift
**Clase CSS:** `.card-lift`  
**Uso:** Añadir a tarjetas para efecto de elevación al pasar el ratón.

```html
<div class="card-lift">
  <h3>Producto Premium</h3>
  <p>Descripción del producto</p>
</div>
```

**Efecto:** Eleva 8px con shadow mejorado

---

### 3️⃣ Producto con efecto tilt 3D
**Atributo datos:** `data-tilt-3d`  
**Uso:** Añadir attr a cualquier elemento para efecto 3D con el ratón.

```html
<img src="product.jpg" alt="Producto" data-tilt-3d>
```

**JavaScript:** Automáticamente inicializado por `setup3DTilt()`

---

### 4️⃣ Parallax de fondo
**Clase CSS:** `.parallax-bg`  
**Uso:** Para elementos con fondo que se mueve al scroll.

```html
<section class="parallax-bg" style="background-image: url('bg.jpg')">
  Contenido con parallax
</section>
```

**JS Nativo:** Hero image ya tiene parallax implementado

---

### 5️⃣ Texto que cambia con el scroll
**Atributo datos:** `data-text-scroll`  
**Uso:** Texto que se anima al volverse visible durante scroll.

```html
<h2 data-text-scroll>Texto que reacciona al scroll</h2>
```

**Efecto:** Fade-in + translateY al entrar en viewport

---

### 6️⃣ Contador de números animado
**Atributo datos:** `data-counter="TARGET" data-duration="2"`  
**Uso:** Anima números cuando el elemento es visible.

```html
<span data-counter="1000" data-duration="2">0</span>
<span>+ clientes satisfechos</span>
```

**Parámetros:**
- `data-counter`: número final
- `data-duration`: duración en segundos (opcional, default: 2)

---

### 7️⃣ Línea que se dibuja
**Clase CSS:** `.draw-line`  
**Uso:** Para SVG con líneas que se dibujan.

```html
<div class="draw-line">
  <svg width="200" height="50">
    <line x1="0" y1="25" x2="200" y2="25" stroke="blue" stroke-width="2"/>
  </svg>
</div>
```

**Efecto:** Stroke-dash animation de 2s

---

### 8️⃣ Reveal de imagen (wipe reveal)
**Clase CSS:** `.wipe-reveal`  
**Uso:** Imagen que aparece con efecto wipe (como cortina).

```html
<img src="image.jpg" class="wipe-reveal" alt="Reveal image">
```

**Duración:** 0.8s | **Easing:** cubic-bezier(0.77, 0, 0.175, 1)

---

### 9️⃣ Glow al pasar el ratón
**Atributo datos:** `data-glow` o `data-glow="pulse"`  
**Uso:** Efecto de brillo al pasar el ratón.

```html
<!-- Glow simple -->
<button data-glow>Botón con glow</button>

<!-- Glow con pulse -->
<div data-glow="pulse">Elemento con pulse</div>
```

**Efectos:** Box-shadow azul dinámico | Pulse animation

---

### 🔟 Scroll horizontal de secciones
**Atributo datos:** `data-scroll-horizontal` con items `data-scroll-item`  
**Uso:** Para secciones que scrollean horizontalmente.

```html
<div data-scroll-horizontal class="scroll-horizontal">
  <div data-scroll-item>Item 1</div>
  <div data-scroll-item>Item 2</div>
  <div data-scroll-item>Item 3</div>
</div>
```

**Efecto:** Cada item entra con fade-in por orden

---

### 1️⃣1️⃣ Texto letra por letra
**Clase CSS:** `.typewriter` or `.typewriter-blink`  
**Uso:** Simula efecto de máquina de escribir.

```html
<h2 class="typewriter">Texto escrito letra por letra</h2>
<p class="typewriter typewriter-blink">Con cursor parpadeante</p>
```

**Duración:** 1.5s | **Pasos:** 40

---

### 1️⃣2️⃣ Imagen de producto con zoom de entrada
**Clase CSS:** `.zoom-in`  
**Uso:** Imágenes que entran con zoom.

```html
<img src="product.jpg" class="zoom-in" alt="Producto">
```

**Efecto:** Scale from 0.8 to 1 | 0.8s duration

---

### 1️⃣3️⃣ Producto fijo mientras haces scroll
**Clase CSS:** `.sticky-product`  
**Uso:** Elemento que se queda fijo al scroll.

```html
<div class="sticky-product">
  <img src="product.jpg" alt="Producto">
</div>
```

**Top:** 100px | Permanece visible durante scroll

---

### 1️⃣4️⃣ Fondo que cambia entre secciones
**Atributo datos:** `data-bg-change="COLOR_O_GRADIENT"`  
**Uso:** Fondo que cambia al llegar a una sección.

```html
<section data-bg-change="rgba(10, 132, 255, 0.05)">
  <h2>Sección con fondo azul</h2>
</section>

<section data-bg-change="linear-gradient(135deg, #fff 0%, #f0f 100%)">
  <h2>Sección con gradiente</h2>
</section>
```

**Transición:** 0.6s ease-in-out

---

### 1️⃣5️⃣ Cursor personalizado interactivo
**Clase CSS:** `.custom-cursor`  
**Uso:** Automático cuando se inicializa. Reemplaza cursor del navegador.

```javascript
// Se activa automáticamente en setupAnimations()
// El cursor crece al pasar sobre enlaces y botones
```

**Características:**
- Sigue el cursor del ratón
- Se agranda al pasar sobre elementos interactivos
- Brilla con color azul

---

### 1️⃣6️⃣ Botones con micro-animaciones
**Clase CSS:** `.btn-micro-animation`  
**Uso:** Botones con pulse animation.

```html
<button class="btn btn-primary btn-micro-animation">
  Click aquí
</button>
```

**Effects:**
- Hover: pulse animation
- Press: scale(0.98)
- Ya implementado en `.btn`

---

### 1️⃣7️⃣ Cards que aparecen en cascada
**Atributo datos:** `data-cascade` en contenedor, `data-cascade-item` en items  
**Uso:** Cards o items que aparecen uno tras otro.

```html
<div data-cascade>
  <div data-cascade-item>Card 1</div>
  <div data-cascade-item>Card 2</div>
  <div data-cascade-item>Card 3</div>
  <div data-cascade-item>Card 4</div>
  <div data-cascade-item>Card 5</div>
</div>
```

**Delays:** Automático: 0s, 0.1s, 0.2s, 0.3s, etc.

---

### 1️⃣8️⃣ Imagen que se separa en capas (depth effect)
**Clase CSS:** `.depth-layer`  
**Uso:** Simula profundidad con múltiples imágenes.

```html
<div class="depth-layer">
  <img src="layer1.png" alt="Base">
  <img src="layer2.png" alt="Middle">
  <img src="layer3.png" alt="Top">
</div>
```

**Efecto:** Cada capa entra con delay para crear profundidad

---

### 1️⃣9️⃣ Animación de carga inicial (intro animation)
**Clase CSS:** `.intro-animation`  
**Uso:** Para animación de carga general.

```html
<div class="intro-animation">
  <h1>Bienvenido a Lixby</h1>
</div>
```

**Efecto:** Scale + fade-in con bounce easing | 1s

---

### 2️⃣0️⃣ Aparición de elementos con stagger
**Clase CSS:** `.stagger-item`  
**Uso:** Múltiples elementos que aparecen con delay.

```html
<div>
  <p class="stagger-item">Párrafo 1</p>
  <p class="stagger-item">Párrafo 2</p>
  <p class="stagger-item">Párrafo 3</p>
  <p class="stagger-item">Párrafo 4</p>
</div>
```

**Delays:** 0s, 0.15s, 0.3s, 0.45s, 0.6s, etc.

---

## 🎯 Ejemplo Completo de Integración

```html
<!DOCTYPE html>
<html lang=\"es\">
<head>
  <meta charset=\"UTF-8\">
  <link rel=\"stylesheet\" href=\"style.css\">
</head>
<body>
  <!-- Hero con parallax y fade-in -->
  <section class=\"hero fade-in-up\">
    <div class=\"hero-content\">
      <h1 class=\"intro-animation\">LixBuds One</h1>
      <p class=\"typewriter\">Sonido increíble. Diseño simple.</p>
    </div>
    <img src=\"hero.jpg\" alt=\"Hero\" class=\"zoom-in\">
  </section>

  <!-- Sección con cascade cards -->
  <section data-cascade data-bg-change=\"rgba(10, 132, 255, 0.05)\">
    <h2 class=\"fade-in-up\">Productos</h2>
    <div class=\"card-lift card-lift\" data-cascade-item>Producto 1</div>
    <div class=\"card-lift\" data-cascade-item>Producto 2</div>
    <div class=\"card-lift\" data-cascade-item>Producto 3</div>
  </section>

  <!-- Producto con tilt y sticky -->
  <section class=\"sticky-product\">
    <img src=\"product.jpg\" data-tilt-3d data-glow=\"pulse\" alt=\"Producto Premium\">
  </section>

  <!-- Contador -->
  <section class=\"stagger-item\">
    <span data-counter=\"10000\" data-duration=\"2\">0</span> clientes
  </section>

  <script src=\"script.js\"></script>
</body>
</html>
```

---

## 🎨 Clases CSS para Aplicar

| Animación | Clase CSS | Atributo Datos |
|-----------|-----------|----------------|
| Fade-in | `.fade-in-up` | — |
| Card Lift | `.card-lift` | — |
| Tilt 3D | — | `data-tilt-3d` |
| Glow | — | `data-glow` |
| Contador | — | `data-counter=\"num\"` |
| Typewriter | `.typewriter` | — |
| Zoom In | `.zoom-in` | — |
| Sticky | `.sticky-product` | — |
| Cascade | — | `data-cascade` |
| Stagger | `.stagger-item` | — |

---

## ⚙️ Configuración de Performance

Todas las animaciones respetan:
- ✅ **Reduced Motion:** Desactivadas si `prefers-reduced-motion` está activado
- ✅ **IntersectionObserver:** Para eficiencia en scroll
- ✅ **RequestAnimationFrame:** Para smoothness
- ✅ **Passive Listeners:** Para mejor scroll performance

---

## 🚀 Quick Start

1. **Copiar clases CSS** → Ya están en `style.css`
2. **Copiar JavaScript** → Ya está en `script.js`
3. **Aplicar atributos/clases** a elementos HTML
4. **Verificar** que GSAP no es obligatorio (funciona sin él)

---

## 📱 Responsive

Todas las animaciones son responsive y se adaptan a:
- Desktop (sin restricciones)
- Tablet (animaciones más suaves)
- Mobile (optimizadas, pueden desactivarse)

---

## 🎬 Tips de Uso

✨ **Para conversiones máximas:**
- Usa `fade-in-up` + `cascade` en product listings
- Usa `card-lift` en features
- Usa `zoom-in` en hero image
- Usa `tilt-3d` en productos premium

⚡ **Para mejor performance:**
- Limita cascades a máx 5 items
- Usa `data-glow` solo en CTAs importantes
- Aplica `sticky-product` solo a 1 elemento

🎭 **Para mejor UX:**
- Siempre respeta `prefers-reduced-motion`
- Usa delays entre 0.1s - 0.5s máximo
- Combina máx 3 efectos por elemento

---

**Última actualización:** March 6, 2026  
**Versión:** 1.0 - All 20 Animations
=======
# 🎬 Complete Animation Guide - Lixby (20 Animations)

Documentación completa de las 20 animaciones implementadas en el proyecto Lixby.

---

## ✅ Animaciones Implementadas

### 1️⃣ Fade-in de secciones
**Clase CSS:** `.fade-in-up`  
**Uso:** Aplicar a cualquier sección que deba aparecer con fade-in.

```html
<section class="fade-in-up">
  <h2>Contenido con fade-in</h2>
</section>
```

**Duración:** 0.8s | **Easing:** ease-out

---

### 2️⃣ Cards con efecto hover lift
**Clase CSS:** `.card-lift`  
**Uso:** Añadir a tarjetas para efecto de elevación al pasar el ratón.

```html
<div class="card-lift">
  <h3>Producto Premium</h3>
  <p>Descripción del producto</p>
</div>
```

**Efecto:** Eleva 8px con shadow mejorado

---

### 3️⃣ Producto con efecto tilt 3D
**Atributo datos:** `data-tilt-3d`  
**Uso:** Añadir attr a cualquier elemento para efecto 3D con el ratón.

```html
<img src="product.jpg" alt="Producto" data-tilt-3d>
```

**JavaScript:** Automáticamente inicializado por `setup3DTilt()`

---

### 4️⃣ Parallax de fondo
**Clase CSS:** `.parallax-bg`  
**Uso:** Para elementos con fondo que se mueve al scroll.

```html
<section class="parallax-bg" style="background-image: url('bg.jpg')">
  Contenido con parallax
</section>
```

**JS Nativo:** Hero image ya tiene parallax implementado

---

### 5️⃣ Texto que cambia con el scroll
**Atributo datos:** `data-text-scroll`  
**Uso:** Texto que se anima al volverse visible durante scroll.

```html
<h2 data-text-scroll>Texto que reacciona al scroll</h2>
```

**Efecto:** Fade-in + translateY al entrar en viewport

---

### 6️⃣ Contador de números animado
**Atributo datos:** `data-counter="TARGET" data-duration="2"`  
**Uso:** Anima números cuando el elemento es visible.

```html
<span data-counter="1000" data-duration="2">0</span>
<span>+ clientes satisfechos</span>
```

**Parámetros:**
- `data-counter`: número final
- `data-duration`: duración en segundos (opcional, default: 2)

---

### 7️⃣ Línea que se dibuja
**Clase CSS:** `.draw-line`  
**Uso:** Para SVG con líneas que se dibujan.

```html
<div class="draw-line">
  <svg width="200" height="50">
    <line x1="0" y1="25" x2="200" y2="25" stroke="blue" stroke-width="2"/>
  </svg>
</div>
```

**Efecto:** Stroke-dash animation de 2s

---

### 8️⃣ Reveal de imagen (wipe reveal)
**Clase CSS:** `.wipe-reveal`  
**Uso:** Imagen que aparece con efecto wipe (como cortina).

```html
<img src="image.jpg" class="wipe-reveal" alt="Reveal image">
```

**Duración:** 0.8s | **Easing:** cubic-bezier(0.77, 0, 0.175, 1)

---

### 9️⃣ Glow al pasar el ratón
**Atributo datos:** `data-glow` o `data-glow="pulse"`  
**Uso:** Efecto de brillo al pasar el ratón.

```html
<!-- Glow simple -->
<button data-glow>Botón con glow</button>

<!-- Glow con pulse -->
<div data-glow="pulse">Elemento con pulse</div>
```

**Efectos:** Box-shadow azul dinámico | Pulse animation

---

### 🔟 Scroll horizontal de secciones
**Atributo datos:** `data-scroll-horizontal` con items `data-scroll-item`  
**Uso:** Para secciones que scrollean horizontalmente.

```html
<div data-scroll-horizontal class="scroll-horizontal">
  <div data-scroll-item>Item 1</div>
  <div data-scroll-item>Item 2</div>
  <div data-scroll-item>Item 3</div>
</div>
```

**Efecto:** Cada item entra con fade-in por orden

---

### 1️⃣1️⃣ Texto letra por letra
**Clase CSS:** `.typewriter` or `.typewriter-blink`  
**Uso:** Simula efecto de máquina de escribir.

```html
<h2 class="typewriter">Texto escrito letra por letra</h2>
<p class="typewriter typewriter-blink">Con cursor parpadeante</p>
```

**Duración:** 1.5s | **Pasos:** 40

---

### 1️⃣2️⃣ Imagen de producto con zoom de entrada
**Clase CSS:** `.zoom-in`  
**Uso:** Imágenes que entran con zoom.

```html
<img src="product.jpg" class="zoom-in" alt="Producto">
```

**Efecto:** Scale from 0.8 to 1 | 0.8s duration

---

### 1️⃣3️⃣ Producto fijo mientras haces scroll
**Clase CSS:** `.sticky-product`  
**Uso:** Elemento que se queda fijo al scroll.

```html
<div class="sticky-product">
  <img src="product.jpg" alt="Producto">
</div>
```

**Top:** 100px | Permanece visible durante scroll

---

### 1️⃣4️⃣ Fondo que cambia entre secciones
**Atributo datos:** `data-bg-change="COLOR_O_GRADIENT"`  
**Uso:** Fondo que cambia al llegar a una sección.

```html
<section data-bg-change="rgba(10, 132, 255, 0.05)">
  <h2>Sección con fondo azul</h2>
</section>

<section data-bg-change="linear-gradient(135deg, #fff 0%, #f0f 100%)">
  <h2>Sección con gradiente</h2>
</section>
```

**Transición:** 0.6s ease-in-out

---

### 1️⃣5️⃣ Cursor personalizado interactivo
**Clase CSS:** `.custom-cursor`  
**Uso:** Automático cuando se inicializa. Reemplaza cursor del navegador.

```javascript
// Se activa automáticamente en setupAnimations()
// El cursor crece al pasar sobre enlaces y botones
```

**Características:**
- Sigue el cursor del ratón
- Se agranda al pasar sobre elementos interactivos
- Brilla con color azul

---

### 1️⃣6️⃣ Botones con micro-animaciones
**Clase CSS:** `.btn-micro-animation`  
**Uso:** Botones con pulse animation.

```html
<button class="btn btn-primary btn-micro-animation">
  Click aquí
</button>
```

**Effects:**
- Hover: pulse animation
- Press: scale(0.98)
- Ya implementado en `.btn`

---

### 1️⃣7️⃣ Cards que aparecen en cascada
**Atributo datos:** `data-cascade` en contenedor, `data-cascade-item` en items  
**Uso:** Cards o items que aparecen uno tras otro.

```html
<div data-cascade>
  <div data-cascade-item>Card 1</div>
  <div data-cascade-item>Card 2</div>
  <div data-cascade-item>Card 3</div>
  <div data-cascade-item>Card 4</div>
  <div data-cascade-item>Card 5</div>
</div>
```

**Delays:** Automático: 0s, 0.1s, 0.2s, 0.3s, etc.

---

### 1️⃣8️⃣ Imagen que se separa en capas (depth effect)
**Clase CSS:** `.depth-layer`  
**Uso:** Simula profundidad con múltiples imágenes.

```html
<div class="depth-layer">
  <img src="layer1.png" alt="Base">
  <img src="layer2.png" alt="Middle">
  <img src="layer3.png" alt="Top">
</div>
```

**Efecto:** Cada capa entra con delay para crear profundidad

---

### 1️⃣9️⃣ Animación de carga inicial (intro animation)
**Clase CSS:** `.intro-animation`  
**Uso:** Para animación de carga general.

```html
<div class="intro-animation">
  <h1>Bienvenido a Lixby</h1>
</div>
```

**Efecto:** Scale + fade-in con bounce easing | 1s

---

### 2️⃣0️⃣ Aparición de elementos con stagger
**Clase CSS:** `.stagger-item`  
**Uso:** Múltiples elementos que aparecen con delay.

```html
<div>
  <p class="stagger-item">Párrafo 1</p>
  <p class="stagger-item">Párrafo 2</p>
  <p class="stagger-item">Párrafo 3</p>
  <p class="stagger-item">Párrafo 4</p>
</div>
```

**Delays:** 0s, 0.15s, 0.3s, 0.45s, 0.6s, etc.

---

## 🎯 Ejemplo Completo de Integración

```html
<!DOCTYPE html>
<html lang=\"es\">
<head>
  <meta charset=\"UTF-8\">
  <link rel=\"stylesheet\" href=\"style.css\">
</head>
<body>
  <!-- Hero con parallax y fade-in -->
  <section class=\"hero fade-in-up\">
    <div class=\"hero-content\">
      <h1 class=\"intro-animation\">LixBuds One</h1>
      <p class=\"typewriter\">Sonido increíble. Diseño simple.</p>
    </div>
    <img src=\"hero.jpg\" alt=\"Hero\" class=\"zoom-in\">
  </section>

  <!-- Sección con cascade cards -->
  <section data-cascade data-bg-change=\"rgba(10, 132, 255, 0.05)\">
    <h2 class=\"fade-in-up\">Productos</h2>
    <div class=\"card-lift card-lift\" data-cascade-item>Producto 1</div>
    <div class=\"card-lift\" data-cascade-item>Producto 2</div>
    <div class=\"card-lift\" data-cascade-item>Producto 3</div>
  </section>

  <!-- Producto con tilt y sticky -->
  <section class=\"sticky-product\">
    <img src=\"product.jpg\" data-tilt-3d data-glow=\"pulse\" alt=\"Producto Premium\">
  </section>

  <!-- Contador -->
  <section class=\"stagger-item\">
    <span data-counter=\"10000\" data-duration=\"2\">0</span> clientes
  </section>

  <script src=\"script.js\"></script>
</body>
</html>
```

---

## 🎨 Clases CSS para Aplicar

| Animación | Clase CSS | Atributo Datos |
|-----------|-----------|----------------|
| Fade-in | `.fade-in-up` | — |
| Card Lift | `.card-lift` | — |
| Tilt 3D | — | `data-tilt-3d` |
| Glow | — | `data-glow` |
| Contador | — | `data-counter=\"num\"` |
| Typewriter | `.typewriter` | — |
| Zoom In | `.zoom-in` | — |
| Sticky | `.sticky-product` | — |
| Cascade | — | `data-cascade` |
| Stagger | `.stagger-item` | — |

---

## ⚙️ Configuración de Performance

Todas las animaciones respetan:
- ✅ **Reduced Motion:** Desactivadas si `prefers-reduced-motion` está activado
- ✅ **IntersectionObserver:** Para eficiencia en scroll
- ✅ **RequestAnimationFrame:** Para smoothness
- ✅ **Passive Listeners:** Para mejor scroll performance

---

## 🚀 Quick Start

1. **Copiar clases CSS** → Ya están en `style.css`
2. **Copiar JavaScript** → Ya está en `script.js`
3. **Aplicar atributos/clases** a elementos HTML
4. **Verificar** que GSAP no es obligatorio (funciona sin él)

---

## 📱 Responsive

Todas las animaciones son responsive y se adaptan a:
- Desktop (sin restricciones)
- Tablet (animaciones más suaves)
- Mobile (optimizadas, pueden desactivarse)

---

## 🎬 Tips de Uso

✨ **Para conversiones máximas:**
- Usa `fade-in-up` + `cascade` en product listings
- Usa `card-lift` en features
- Usa `zoom-in` en hero image
- Usa `tilt-3d` en productos premium

⚡ **Para mejor performance:**
- Limita cascades a máx 5 items
- Usa `data-glow` solo en CTAs importantes
- Aplica `sticky-product` solo a 1 elemento

🎭 **Para mejor UX:**
- Siempre respeta `prefers-reduced-motion`
- Usa delays entre 0.1s - 0.5s máximo
- Combina máx 3 efectos por elemento

---

**Última actualización:** March 6, 2026  
**Versión:** 1.0 - All 20 Animations
>>>>>>> f974a61f00029587a2b429690c7b259232ae349f
