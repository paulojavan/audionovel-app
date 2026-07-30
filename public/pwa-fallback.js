(() => {
  const reload = () => window.location.reload();

  document.querySelectorAll("[data-pwa-retry]").forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.add("loading");
      button.disabled = true;
      window.setTimeout(reload, 300);
    });
  });

  document.querySelectorAll("[data-pwa-home]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.assign("/");
    });
  });

  document.querySelectorAll("[data-pwa-hide-on-error]").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
    });
  });

  window.addEventListener("online", () => {
    window.setTimeout(reload, 500);
  });
})();
