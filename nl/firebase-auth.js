import {
createUserWithEmailAndPassword,
signInWithEmailAndPassword,
signOut,
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"

class LixbyAuth {

constructor(){

this.initRegister()
this.initLogin()
this.initSession()

}

initRegister(){

const form = document.getElementById("registerForm")
if(!form) return

form.addEventListener("submit", async e=>{

e.preventDefault()

const email = form.querySelector('[type="email"]').value
const password = form.querySelector('[type="password"]').value

try{

await createUserWithEmailAndPassword(auth,email,password)

LixbyApp.showNotification("Account created","success")

window.location="/account/dashboard.html"

}catch(err){

LixbyApp.showNotification(err.message,"error")

}

})

}

initLogin(){

const form = document.getElementById("loginForm")
if(!form) return

form.addEventListener("submit", async e=>{

e.preventDefault()

const email = form.querySelector('[type="email"]').value
const password = form.querySelector('[type="password"]').value

try{

await signInWithEmailAndPassword(auth,email,password)

window.location="/account/dashboard.html"

}catch(err){

LixbyApp.showNotification("Login failed","error")

}

})

}

initSession(){

onAuthStateChanged(auth,user=>{

if(user){

console.log("Logged:",user.email)

}else{

console.log("Not logged")

}

})

}

logout(){

signOut(auth)

}

}

window.lixbyAuth = new LixbyAuth()