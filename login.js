(function () {
  "use strict";

  const GENERIC = CozyAuth.GENERIC_ERROR;
  const panels = {
    login: document.getElementById("loginForm"),
    register: document.getElementById("registerForm"),
    forgot: document.getElementById("forgotForm"),
    reset: document.getElementById("resetForm"),
  };

  function showPanel(name) {
    Object.entries(panels).forEach(([key, el]) => {
      el.hidden = key !== name;
    });
    document.querySelectorAll(".auth-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.panel === name);
    });
    document.querySelectorAll(".auth-error, .auth-ok").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
  }

  function showError(id, message) {
    const el = document.getElementById(id);
    el.hidden = false;
    el.textContent = message;
  }

  CozyAuth.ready.then(() => CozyAuth.redirectIfLoggedIn());

  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.panel));
  });
  document.getElementById("showForgot").addEventListener("click", () => showPanel("forgot"));
  document.getElementById("showReset").addEventListener("click", () => showPanel("reset"));

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const result = await CozyAuth.login(data.email, data.password);
    if (!result.ok) {
      showError("loginError", GENERIC);
      return;
    }
    window.location.replace(`dashboard.html#${CozyAuth.homeView(result.user.role)}`);
  });

  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const result = await CozyAuth.register(data);
    if (!result.ok) {
      showError("registerError", GENERIC);
      return;
    }
    window.location.replace(`dashboard.html#${CozyAuth.homeView(result.user.role)}`);
  });

  document.getElementById("forgotForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const result = await CozyAuth.requestReset(data.email);
    if (!result.ok) {
      showError("forgotError", GENERIC);
      return;
    }
    const ok = document.getElementById("forgotOk");
    ok.hidden = false;
    ok.textContent = `Jika akun terdaftar, kode reset berlaku 30 menit. Simulasi pengiriman: ${result.previewCode}`;
  });

  document.getElementById("resetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const result = await CozyAuth.resetPassword(data.email, data.code, data.password);
    if (!result.ok) {
      showError("resetError", GENERIC);
      return;
    }
    showPanel("login");
    showError("loginError", "Kata sandi diperbarui. Silakan masuk.");
  });
})();
