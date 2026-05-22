function setMessage(type, text) {
  document.getElementById("msg").innerHTML = text ? `<div class="${type}">${text}</div>` : "";
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  // Guarda el actor elegido para abrir el panel con sus permisos.
  const actor = document.getElementById("actor_select").value;
  localStorage.setItem("ph_actor", actor);
  setMessage("ok", `Ingresando como ${actor}...`);
  window.location.href = "/panel";
});
