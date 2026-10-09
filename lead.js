/* TB Solutions — drop-in lead form. One line on any page:
     <div data-lead="websites"></div>   ...   <script defer src="/lead.js"></script>
   data-lead = offer key (websites | receptionist | reviews | planner | leads | rank | bundle | general)
   data-cta  = button text (optional)      data-ask = placeholder for the note (optional)
   data-theme = "dark" when the surrounding section has a dark background (optional)
   Posts to the site-intake edge function → `intakes` table (shows in HQ → Leads) → texts Nick + the prospect. */
(function () {
  var URL = "https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/site-intake";
  var SMS = "sms:+14848418501?&body=";
  var ASK = {
    websites: "What's wrong with your site right now?",
    receptionist: "How many calls go to voicemail a week?",
    reviews: "How many Google reviews do you have?",
    planner: "What kind of remodel jobs do you want more of?",
    leads: "Do you have the Google Guaranteed badge yet?",
    rank: "Which town do you want to show up in?",
    bundle: "What's costing you the most jobs right now?",
    general: "What's costing you jobs right now?"
  };
  var CTA = {
    websites: "Get my site started", receptionist: "Get my phones answered", reviews: "Start getting reviews",
    planner: "Add the planner", leads: "Get me Google Guaranteed", rank: "Get my free checkup",
    bundle: "Set up the works", general: "Text me what it costs"
  };
  var css = "" +
    ".tb-lead{display:grid;gap:10px;max-width:520px;font-family:inherit}" +
    ".tb-lead .r{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    "@media(max-width:480px){.tb-lead .r{grid-template-columns:1fr}}" +
    ".tb-lead input,.tb-lead textarea{font:inherit;font-weight:600;font-size:1em;padding:.7em .8em;border:3px solid #14110F;border-radius:12px;background:#fff;color:#14110F;width:100%}" +
    ".tb-lead textarea{min-height:3.2em;resize:vertical}" +
    ".tb-lead input::placeholder,.tb-lead textarea::placeholder{color:#6b6560;font-weight:500}" +
    ".tb-lead input:focus,.tb-lead textarea:focus{outline:4px solid #1B4FD8;outline-offset:2px}" +
    ".tb-lead button{font:inherit;font-weight:800;font-size:1.05em;padding:.9em 1.3em;border-radius:999px;border:3px solid #14110F;background:#14110F;color:#FFD23F;cursor:pointer;transition:transform .15s}" +
    ".tb-lead button:hover{transform:translateY(-2px)}.tb-lead button:disabled{opacity:.6;cursor:wait;transform:none}" +
    ".tb-lead .hp{position:absolute;left:-9999px;opacity:0;height:0;width:0}" +
    ".tb-lead .fine{font-size:.82em;font-weight:600;opacity:.75;max-width:30em}" +
    ".tb-lead .who{display:flex;align-items:center;gap:12px;margin-bottom:4px}" +
    ".tb-lead .who img{width:52px;height:52px;border-radius:50%;object-fit:cover;flex:none;box-shadow:0 0 0 2px #fff,0 0 0 3.5px #D9D3C8}" +
    ".tb-lead .who b{display:block;font-size:1em}.tb-lead .who span{font-size:.85em;opacity:.75}" +
    ".tb-lead .err{color:#D7263D;font-weight:700;display:none}" +
    ".tb-lead .consent{display:flex;gap:.6em;align-items:flex-start;font-size:.82em;line-height:1.4;color:#3A4149;font-weight:500;max-width:34em;cursor:pointer}" +
    ".tb-lead .consent input{margin-top:.3em;width:18px;height:18px;flex:none;accent-color:#10263F}" +
    ".tb-lead .consent a{color:#161A1F;font-weight:600}" +
    ".tb-lead .ok{font-weight:700;font-size:1.1em;line-height:1.3;max-width:28em}" +
    ".tb-lead .ok a{font-weight:800}" +
    ".tb-lead.dark input,.tb-lead.dark textarea{border-color:#FFD23F}" +
    ".tb-lead.dark button{background:#FFD23F;color:#14110F;border-color:#FFD23F}" +
    ".tb-lead.dark .err{color:#FFB3BD}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var CONSENT = "Yes, text me. By checking this box I agree to receive text messages from TB Solutions at the number above about my request. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. Consent is not required to buy anything; leave it unchecked and Nick will call instead.";
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function utm() { try { return (window.adSrc && window.adSrc()) || ""; } catch (e) { return ""; } }

  function mount(host) {
    var offer = host.getAttribute("data-lead") || "general";
    var cta = host.getAttribute("data-cta") || CTA[offer] || CTA.general;
    var ask = host.getAttribute("data-ask") || ASK[offer] || ASK.general;
    var dark = host.getAttribute("data-theme") === "dark";
    var f = document.createElement("form");
    f.className = "tb-lead" + (dark ? " dark" : "");
    f.noValidate = true;
    f.innerHTML =
      '<div class="who"><img src="/img/nick-320.webp" width="52" height="52" alt="Nick Byrd" loading="lazy"><div><b>Nick Byrd, owner</b><span>Pottstown, PA. You deal with me, not a sales team.</span></div></div>' +
      '<div class="r"><input name="name" placeholder="Your name" autocomplete="name" required>' +
      '<input name="phone" type="tel" placeholder="Cell number" autocomplete="tel" inputmode="tel" required></div>' +
      '<input name="business" placeholder="Company name (optional)" autocomplete="organization">' +
      '<textarea name="goal" placeholder="' + esc(ask) + '"></textarea>' +
      '<input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<label class="consent"><input type="checkbox" name="sms_consent" value="1"><span>' + esc(CONSENT).replace("Reply STOP", "Reply <b>STOP</b>") + ' See our <a href="/sms-terms/" target="_blank" rel="noopener">SMS terms</a> and <a href="/privacy/" target="_blank" rel="noopener">privacy policy</a>.</span></label>' +
      '<div class="err" role="alert"></div>' +
      '<button type="submit">' + esc(cta) + ' →</button>' +
      '<div class="fine">Nick gets back to you within the hour, 8am–8pm. No contract, no pitch.</div>';
    host.replaceWith(f);
    var err = f.querySelector(".err"), btn = f.querySelector("button");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      err.style.display = "none";
      var d = {};
      ["name", "phone", "business", "goal", "_honey"].forEach(function (k) { d[k] = f.elements[k].value.trim(); });
      d.sms_consent = !!f.elements.sms_consent.checked;
      d.sms_consent_text = d.sms_consent ? CONSENT : "";
      if (!d.name) return fail("What should Nick call you?");
      if (d.phone.replace(/\D/g, "").length < 10) return fail("Enter a 10-digit cell number so Nick can text you.");
      d.offer = offer; d.page = location.pathname; d.utm = utm();
      btn.disabled = true; btn.textContent = "Sending…";
      fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (j) {
          if (!j.ok) return fail(j.error || "Couldn't send that.");
          try { window.trackLead && window.trackLead(offer); } catch (x) {}
          var first = d.name.split(" ")[0];
          f.innerHTML = '<div class="ok">Got it, ' + esc(first) + '. Nick will ' + (d.sms_consent ? 'text' : 'call') + ' you at ' + esc(d.phone) + ' within the hour.<br><br>' +
            'In a hurry? <a href="tel:+14848418501">Call him now: (484) 841-8501</a></div>';
        })
        .catch(function () { fail("Couldn't send that."); });
    });
    function fail(msg) {
      btn.disabled = false; btn.textContent = cta + " →";
      err.innerHTML = esc(msg) + ' <a href="' + SMS + encodeURIComponent("Hey Nick, saw " + location.pathname + ". Got 10 min?") + '">Or just text Nick.</a>';
      err.style.display = "block";
    }
  }
  function init() { document.querySelectorAll("[data-lead]").forEach(mount); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
