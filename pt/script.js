/**
 * Lixby - Main Script
 * Handles interactions, animations, and dynamic functionality
 */

class LixbyApp {

constructor(){
this.init();
}

init(){
this.setupLoading();
this.setupNavigation();
this.setupScrollEffects();
this.setupAnimations();
this.setupPerformance();
}


/* ============================= */
/* LOADING */
/* ============================= */

setupLoading(){

const skeleton = document.getElementById("loadingSkeleton");

if(!skeleton) return;

window.addEventListener("load",()=>{

setTimeout(()=>{

skeleton.style.opacity="0";

setTimeout(()=>{
skeleton.style.display="none";
},300);

},100);

});

}


/* ============================= */
/* NAVIGATION */
/* ============================= */

setupNavigation(){

const nav = document.querySelector(".nav");

if(!nav) return;

window.addEventListener("scroll",()=>{

if(window.scrollY > 80){

nav.classList.add("nav-scrolled");

}else{

nav.classList.remove("nav-scrolled");

}

},{passive:true});


/* smooth scroll */

const links = document.querySelectorAll(".nav-link[href^='#']");

links.forEach(link=>{

link.addEventListener("click",e=>{

e.preventDefault();

const id = link.getAttribute("href").substring(1);
const el = document.getElementById(id);

if(el){

window.scrollTo({
top:el.offsetTop - 80,
behavior:"smooth"
});

}

});

});

}


/* ============================= */
/* SCROLL EFFECTS */
/* ============================= */

setupScrollEffects(){

const heroImage = document.querySelector(".hero-image img");

if(heroImage){

window.addEventListener("scroll",()=>{

const scrolled = window.pageYOffset;
heroImage.style.transform = `translateY(${scrolled * -0.3}px)`;

},{passive:true});

}


/* reveal animation */

const observer = new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add("visible");

}

});

},{threshold:0.2});


document.querySelectorAll(".fade-scale, .wipe-reveal").forEach(el=>{
observer.observe(el);
});

}


/* ============================= */
/* ANIMATIONS */
/* ============================= */

setupAnimations(){

this.setup3DTilt();
this.setupGlowEffects();
this.setupCounters();
this.setupCustomCursor();

}


/* ============================= */
/* 3D TILT */
/* ============================= */

setup3DTilt(){

const elements = document.querySelectorAll("[data-tilt-3d]");

elements.forEach(el=>{

el.addEventListener("mousemove",(e)=>{

const rect = el.getBoundingClientRect();

const x = e.clientX - rect.left;
const y = e.clientY - rect.top;

const centerX = rect.width/2;
const centerY = rect.height/2;

const rotateX = (y-centerY)*0.08;
const rotateY = (centerX-x)*0.08;

el.style.transform = `
perspective(1000px)
rotateX(${rotateX}deg)
rotateY(${rotateY}deg)
scale(1.05)
`;

});

el.addEventListener("mouseleave",()=>{

el.style.transform="perspective(1000px) rotateX(0) rotateY(0)";

});

});

}


/* ============================= */
/* GLOW EFFECT */
/* ============================= */

setupGlowEffects(){

const elements = document.querySelectorAll("[data-glow]");

elements.forEach(el=>{

el.classList.add("glow-hover");

if(el.dataset.glow === "pulse"){

el.classList.add("glow-pulse");

}

});

}


/* ============================= */
/* COUNTER */
/* ============================= */

setupCounters(){

const counters = document.querySelectorAll("[data-counter]");

counters.forEach(counter=>{

const target = parseInt(counter.dataset.counter);
let current = 0;

const update = ()=>{

current += target/120;

if(current >= target){

counter.textContent = target;
return;

}

counter.textContent = Math.floor(current);

requestAnimationFrame(update);

};

const observer = new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

update();
observer.unobserve(counter);

}

});

});

observer.observe(counter);

});

}


/* ============================= */
/* CUSTOM CURSOR */
/* ============================= */

setupCustomCursor(){

const cursor = document.createElement("div");
cursor.className="custom-cursor";

document.body.appendChild(cursor);

document.addEventListener("mousemove",(e)=>{

cursor.style.left = e.clientX + "px";
cursor.style.top = e.clientY + "px";

},{passive:true});


const interactive = document.querySelectorAll("a,button");

interactive.forEach(el=>{

el.addEventListener("mouseenter",()=>{
cursor.classList.add("active");
});

el.addEventListener("mouseleave",()=>{
cursor.classList.remove("active");
});

});

}


/* ============================= */
/* PERFORMANCE */
/* ============================= */

setupPerformance(){

if(window.Lenis){

this.lenis = new Lenis({
duration:1.2,
smooth:true
});

const raf = (time)=>{
this.lenis.raf(time);
requestAnimationFrame(raf);
};

requestAnimationFrame(raf);

}

}

}


/* ============================= */
/* INIT */
/* ============================= */

document.addEventListener("DOMContentLoaded",()=>{

window.lixbyApp = new LixbyApp();

});


/* ============================= */
/* ERROR HANDLING */
/* ============================= */

window.addEventListener("error",e=>{
console.error("JS Error:",e.error);
});

window.addEventListener("unhandledrejection",e=>{
console.error("Promise error:",e.reason);
});