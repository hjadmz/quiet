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
    // A post with three snippets otherwise offers three buttons all named
    // "copy". Rouge already recorded the language on the wrapper, so say which.
    var lang = (block.className.match(/language-([\w-]+)/) || [0, "code"])[1];
    btn.setAttribute("aria-label", "copy " + lang);

    // One place the label and the announcement change together.
    // Clearing the live region first matters: repeating a message verbatim is
    // not a mutation, so a second identical result would announce nothing.
    // Clearing the pending timer matters too, or the first copy's reset lands
    // on the second copy's confirmation and it reads as having done nothing.
    function say(text) {
      btn.textContent = text;
      live.textContent = "";
      live.textContent = text;
      clearTimeout(btn._reset);
      btn._reset = setTimeout(function () {
        btn.textContent = "copy";
        live.textContent = "";
      }, 2000);
    }

    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(code.innerText).then(function () {
        say("copied");
      }).catch(function () {
        say("copy failed");
      });
    });
    block.classList.add("has-copy");
    // Before the <pre>, not after it: the button is painted at the top right of
    // the block, and appending it put the tab stop after the code it sits above.
    block.insertBefore(btn, block.firstChild);
  });
})();
