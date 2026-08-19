/* code copy button. JS off = no button */
(function () {
  if (!navigator.clipboard) return;
  var live = document.createElement("div");
  live.setAttribute("aria-live", "polite");
  live.className = "visually-hidden";
  document.body.appendChild(live);
  document.querySelectorAll("div.highlighter-rouge").forEach(function (block) {
    var code = block.querySelector("pre code");
    if (!code) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "copy";
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(code.innerText).then(function () {
        live.textContent = btn.textContent = "copied";
        setTimeout(function () {
          btn.textContent = "copy";
          live.textContent = "";
        }, 2000);
      }).catch(function () {
        live.textContent = btn.textContent = "copy failed";
      });
    });
    block.classList.add("has-copy");
    block.appendChild(btn);
  });
})();
