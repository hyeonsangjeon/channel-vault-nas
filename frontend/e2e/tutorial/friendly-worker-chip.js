// Tutorial-only relabel of the sidebar runtime status chip.
//
// The real app keeps its operator-console wording ("Live worker enabled/disabled"
// + scheduler labels). For the first-run screencast that reads too developer-ish,
// so this init script rewrites ONLY the on-screen chip text to friendly,
// confirmation-first language. It never touches app source, locales, or data:
// it observes the DOM and maps the existing tone class to friendlier copy.
//
//   tone "good"  -> worker armed   -> "Download engine armed" / "Running your confirmed pass"
//   tone else    -> worker off     -> "Download engine off"   / "Until you confirm a pass"
//   tone "warn"  -> restart pending -> left untouched (rare, not shown in the tour)
(() => {
  const relabelOne = (el) => {
    const title = el.querySelector("strong");
    const detail = el.querySelector("span");
    if (!title) return;
    if (el.classList.contains("warn")) return;
    const armed = el.classList.contains("good");
    const titleText = armed ? "Download engine armed" : "Download engine off";
    const detailText = armed ? "Running your confirmed pass" : "Until you confirm a pass";
    if (title.textContent !== titleText) title.textContent = titleText;
    if (detail && detail.textContent !== detailText) detail.textContent = detailText;
  };

  const relabelAll = () => {
    document.querySelectorAll(".sidebar-status").forEach(relabelOne);
  };

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      relabelAll();
    });
  };

  const boot = () => {
    relabelAll();
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
