document.querySelectorAll('#copyrightYear').forEach(function (el) {
    el.textContent = new Date().getFullYear();
});
