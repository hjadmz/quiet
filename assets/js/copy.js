/* quiet — copy button for code blocks. JS off = no button, no loss. */
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
        btn.textContent = "copied";
        live.textContent = "copied to clipboard";
        setTimeout(function () {
          btn.textContent = "copy";
          live.textContent = "";
        }, 2000);
      });
    });
    block.appendChild(btn);
  });
})();
