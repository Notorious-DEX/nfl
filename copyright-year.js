document.querySelectorAll('#copyrightYear').forEach(function (el) {
    el.textContent = new Date().getFullYear();
});

document.querySelectorAll('.footer > div').forEach(function (el) {
    if (el.id === 'copyrightYear' || el.querySelector('#copyrightYear')) return;
    if (/\u00a9\s*20\d{2}\s*BROpicks/.test(el.textContent)) {
        el.innerHTML = '© <span id="copyrightYear">' + new Date().getFullYear() + '</span> BROpicks. All rights reserved.';
    }
});
