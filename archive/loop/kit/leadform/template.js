/* ============================================================================
   THE COMPLIANT LEAD FORM
   ----------------------------------------------------------------------------
   Every local business wants to text its customers, and almost every one of
   them is doing it in a way that would fail an A2P 10DLC review — a form that
   collects a mobile number with no consent language anywhere near it, or a
   pre-ticked box, or "we may contact you" buried in a footer.

   The carriers do not object to businesses texting customers. They object to
   not being able to prove the customer asked for it. So this generator makes
   the provable version the DEFAULT and the only version: the disclosure is
   assembled from the shop's own details, the box ships unticked, the exact
   words shown are stored with the lead, and the form still submits when
   someone declines — because consent that is required to get service is not
   consent.

   WHAT THE RULES ACTUALLY REQUIRE (US, A2P 10DLC / CTIA):
     · A standalone consent control — an unticked checkbox, never pre-selected
     · The business name, and what kinds of messages will be sent
     · Message frequency, or an honest "frequency varies"
     · "Msg & data rates may apply"
     · "Reply STOP to opt out, HELP for help"
     · A visible link to the privacy policy and the SMS terms
     · Consent must not be a condition of purchase or of using the form
     · The privacy policy must say mobile opt-in data is never sold or shared
       with third parties for marketing — carriers check this page directly
     · Records of who agreed, to what wording, and when

   The last one is the one everybody skips and the only one that matters when
   somebody complains. lead_capture_with_consent() in hq/sms-consent.sql stores
   the wording verbatim next to the lead, which is what turns "we think they
   opted in" into evidence.

   None of this is legal advice, and rules differ outside the US. It is the
   working checklist that gets a small local campaign registered.
   ============================================================================ */
(function (w) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function embed(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }
  function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '').slice(0, 40); }

  var SUPA_URL = 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYmppcWR3emdramttcXlqc21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzc1NTEsImV4cCI6MjA5OTk1MzU1MX0.Naocw-B0B6Z7CLg197yxLezd58a6f5XoMLEiea5b0Ro';

  var DEMO = {
    slug: 'raysbarbers',
    business: "Ray's Barbershop",
    program: "Ray's Barbershop reminders & offers",
    kinds: ['appointment reminders', 'occasional offers'],
    frequency: 'up to 4 msgs/month',
    helpPhone: '(555) 123-4567',
    privacyUrl: 'https://tbsol.net/privacy/',
    termsUrl: 'https://tbsol.net/sms-terms/',
    headline: 'Book your next cut',
    sub: 'Leave your details and we will text you back with the next open chair.',
    services: ['Haircut', 'Skin fade', 'Beard trim', 'Cut & beard', 'Something else'],
    theme: { mode: 'dark', accent: '#ffd45a' }
  };

  /* The one sentence the whole thing exists to get right. Built from the
     shop's own facts so it is specific and true, and assembled in one place so
     it cannot drift between the form, the stored record and the wording
     submitted to the carrier. */
  function consentText(cfg) {
    var kinds = (cfg.kinds && cfg.kinds.length) ? cfg.kinds.join(' and ') : 'text messages';
    return 'I agree to receive ' + kinds + ' by text message from ' + (cfg.business || 'this business') + '. '
      + 'Message frequency: ' + (cfg.frequency || 'varies') + '. '
      + 'Msg & data rates may apply. Reply STOP to opt out, HELP for help. '
      + 'Consent is not a condition of any purchase.';
  }

  /* What to paste into the Twilio campaign registration. Rejections are
     overwhelmingly for a vague opt-in description, so this writes the specific
     one out of the same facts. */
  function a2pPack(cfg) {
    var url = cfg.formUrl || '[paste the live URL of your form here]';
    return {
      optInDescription:
        'Customers opt in through a web form at ' + url + '. The form collects name, mobile number and the '
        + 'service they want. Beneath the mobile field there is an unchecked checkbox reading: "' + consentText(cfg) + '" '
        + 'The checkbox is not pre-selected and submitting the form without it still works — SMS consent is never '
        + 'required to use the form or to buy anything. The privacy policy (' + (cfg.privacyUrl || '') + ') and the SMS terms ('
        + (cfg.termsUrl || '') + ') are linked next to the checkbox. Every submission stores the exact consent wording shown, '
        + 'together with the timestamp and the page URL.',
      sampleMessages: [
        (cfg.business || 'Business') + ': Hi {name}, you\'re booked for {service} on {day} at {time}. Reply STOP to opt out.',
        (cfg.business || 'Business') + ': 3 chairs open tomorrow 1-4pm. Reply BOOK to grab one. Msg&data rates may apply. Reply STOP to opt out.'
      ],
      helpMessage: (cfg.business || 'Business') + ': Reply HELP for help or call ' + (cfg.helpPhone || '[phone]')
        + '. Msg & data rates may apply. Reply STOP to unsubscribe.',
      stopMessage: 'You are unsubscribed from ' + (cfg.business || 'Business')
        + ' messages. No more messages will be sent. Reply HELP for help.',
      privacyClause:
        'Mobile information collected for SMS is never sold, rented or shared with third parties or affiliates for '
        + 'their own marketing or lead-generation purposes. Phone numbers collected for text messaging are used only '
        + 'to send the messages described at the point of opt-in, and are shared only with the messaging provider '
        + 'that delivers them on our behalf. You can opt out at any time by replying STOP.'
    };
  }

  /* A live audit, not a badge. Anything red here is a real reason a campaign
     gets rejected or a complaint sticks. */
  function audit(cfg) {
    var t = consentText(cfg);
    return [
      { ok: !!(cfg.business && cfg.business.length > 1), t: 'The business is named in the consent line' },
      { ok: !!(cfg.kinds && cfg.kinds.length),           t: 'The kinds of message are described' },
      { ok: !!(cfg.frequency && cfg.frequency.length > 2), t: 'Message frequency is stated' },
      { ok: /Msg & data rates may apply/.test(t),        t: '"Msg & data rates may apply" is present' },
      { ok: /Reply STOP to opt out, HELP for help/.test(t), t: 'STOP and HELP instructions are present' },
      { ok: /Consent is not a condition/.test(t),        t: 'Consent is not a condition of purchase' },
      { ok: !!cfg.privacyUrl,                            t: 'Privacy policy is linked at the point of consent' },
      { ok: !!cfg.termsUrl,                              t: 'SMS terms are linked at the point of consent' },
      { ok: !!cfg.helpPhone,                             t: 'A real phone number answers HELP' },
      { ok: !!slugify(cfg.slug),                         t: 'Consent records have a business to file under' }
    ];
  }

  function render(cfg) {
    cfg = cfg || DEMO;
    var slug = slugify(cfg.slug || cfg.business) || 'shop';
    var dark = (cfg.theme && cfg.theme.mode) !== 'light';
    var acc = (cfg.theme && cfg.theme.accent) || '#ffd45a';
    var bg = dark ? '#0a0b12' : '#f7f6f3', text = dark ? '#f2f4ff' : '#191a1f',
        muted = dark ? '#a3abc4' : '#6a6e7d', line = dark ? 'rgba(255,255,255,.11)' : 'rgba(0,0,0,.12)',
        panel = dark ? 'rgba(255,255,255,.045)' : '#ffffff', ink = dark ? '#221a00' : '#221a00';
    var ct = consentText(cfg);

    var services = (cfg.services || []).filter(Boolean);

    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + esc(cfg.headline || 'Get in touch') + ' — ' + esc(cfg.business || '') + '</title>\n' +
      '<meta name="description" content="' + esc(cfg.sub || '') + '">\n' +
      '<meta name="theme-color" content="' + bg + '">\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet" media="print" onload="this.media=\'all\'">\n' +
      '<noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"></noscript>\n' +
      '<style>\n' +
      '*{box-sizing:border-box}body{margin:0;background:' + bg + ';color:' + text + ';font-family:Inter,system-ui,sans-serif;line-height:1.6;padding:26px 16px}\n' +
      '.card{max-width:520px;margin:0 auto;border:1px solid ' + line + ';border-radius:20px;background:' + panel + ';padding:26px}\n' +
      'h1{font-size:26px;margin:0 0 6px;letter-spacing:-.02em}\n' +
      '.sub{color:' + muted + ';margin:0 0 18px;font-size:15px}\n' +
      'label{display:block;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:' + muted + ';margin:14px 0 5px}\n' +
      'input,select,textarea{width:100%;border:1px solid ' + line + ';border-radius:12px;background:' + (dark ? 'rgba(255,255,255,.05)' : '#fff') + ';color:' + text + ';padding:13px 14px;font:inherit;font-size:16px}\n' +
      'input:focus,select:focus,textarea:focus{outline:0;border-color:' + acc + '}\n' +
      'textarea{min-height:70px;resize:vertical}\n' +
      '.consent{display:flex;gap:11px;align-items:flex-start;border:1px solid ' + line + ';border-radius:14px;padding:13px;margin-top:18px;background:' + (dark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)') + '}\n' +
      '.consent input{width:20px;height:20px;flex:0 0 auto;margin-top:2px;accent-color:' + acc + '}\n' +
      '.consent span{font-size:12.5px;color:' + muted + ';line-height:1.55}\n' +
      '.consent a{color:' + acc + '}\n' +
      'button{width:100%;margin-top:16px;border:0;border-radius:999px;padding:14px;font:inherit;font-weight:800;font-size:15.5px;cursor:pointer;background:' + acc + ';color:' + ink + '}\n' +
      'button[disabled]{opacity:.6;cursor:not-allowed}\n' +
      '.err{color:#ff8080;font-size:14px;min-height:18px;margin-top:8px}\n' +
      '.fine{color:' + muted + ';font-size:11.5px;margin-top:14px;text-align:center}\n' +
      '.done{text-align:center;padding:18px 0}.done .t{font-size:40px}\n' +
      '.hide{display:none}\n' +
      '</style>\n</head>\n<body>\n' +
      '<div class="card">\n<div id="form">\n' +
      '<h1>' + esc(cfg.headline || 'Get in touch') + '</h1>\n' +
      '<p class="sub">' + esc(cfg.sub || '') + '</p>\n' +
      '<label for="nm">Your name</label><input id="nm" autocomplete="name" maxlength="80">\n' +
      '<label for="ph">Mobile number</label><input id="ph" type="tel" inputmode="tel" autocomplete="tel" maxlength="24">\n' +
      '<label for="em">Email <span style="text-transform:none;font-weight:600">(optional)</span></label><input id="em" type="email" inputmode="email" autocomplete="email" maxlength="120">\n' +
      (services.length
        ? '<label for="sv">What do you need?</label><select id="sv">' +
          services.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select>\n'
        : '') +
      '<label for="ms">Anything else?</label><textarea id="ms" maxlength="500"></textarea>\n' +
      '<input type="text" id="hp" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true">\n' +
      /* Unticked, never required, and the links sit inside the same block a
         reviewer will screenshot. */
      '<label class="consent" for="sms"><input type="checkbox" id="sms">\n<span>' + esc(ct) +
      (cfg.privacyUrl || cfg.termsUrl ? '<br>' : '') +
      (cfg.privacyUrl ? '<a href="' + esc(cfg.privacyUrl) + '" target="_blank" rel="noopener">Privacy policy</a>' : '') +
      (cfg.privacyUrl && cfg.termsUrl ? ' · ' : '') +
      (cfg.termsUrl ? '<a href="' + esc(cfg.termsUrl) + '" target="_blank" rel="noopener">SMS terms</a>' : '') +
      '</span></label>\n' +
      '<button id="go">Send</button>\n<div class="err" id="err"></div>\n' +
      '<p class="fine">Leaving the box unticked is fine — we will still get your message and reply the normal way.</p>\n' +
      '</div>\n' +
      '<div id="done" class="hide done"><div class="t">✅</div><h1 style="font-size:21px">Got it</h1>' +
      '<p class="sub" id="doneMsg" style="margin:6px 0 0"></p></div>\n' +
      '</div>\n' +
      '<script>\n(function(){\n' +
      'var CFG=' + embed({ slug: slug, business: cfg.business || '', program: cfg.program || '', frequency: cfg.frequency || '', consent: ct }) + ';\n' +
      'var U=' + JSON.stringify(SUPA_URL) + ',K=' + JSON.stringify(SUPA_KEY) + ';\n' +
      'function el(i){return document.getElementById(i)}\n' +
      'el("go").addEventListener("click",function(){\n' +
      '  var e=el("err");e.textContent="";\n' +
      '  if(el("hp").value) return;\n' +
      '  var nm=(el("nm").value||"").trim(),ph=(el("ph").value||"").trim(),em=(el("em").value||"").trim();\n' +
      '  var ms=(el("ms").value||"").trim(),sv=el("sv")?el("sv").value:null,ok=el("sms").checked;\n' +
      '  if(nm.length<2){e.textContent="Please enter your name.";el("nm").focus();return;}\n' +
      '  if(ph.replace(/\\D/g,"").length<10){e.textContent="Enter a mobile number we can reach you on.";el("ph").focus();return;}\n' +
      '  var b=el("go");b.disabled=true;b.textContent="Sending…";\n' +
      '  fetch(U+"/rest/v1/rpc/lead_capture_with_consent",{method:"POST",\n' +
      '    headers:{apikey:K,Authorization:"Bearer "+K,"Content-Type":"application/json"},\n' +
      '    body:JSON.stringify({p_client:CFG.slug,p_name:nm,p_phone:ph,p_email:em||null,p_service:sv,p_message:ms||null,\n' +
      '      p_sms_consent:ok,p_consent_text:ok?CFG.consent:null,p_program:CFG.program,p_frequency:CFG.frequency,\n' +
      '      p_source_url:location.href,p_user_agent:navigator.userAgent})})\n' +
      '  .then(function(r){return r.json()}).then(function(j){\n' +
      '    if(!j||!j.ok){throw new Error((j&&j.error)||"failed")}\n' +
      '    el("form").classList.add("hide");el("done").classList.remove("hide");\n' +
      '    el("doneMsg").textContent=nm.split(/\\s+/)[0]+", we have your details and will come straight back to you.";\n' +
      '  }).catch(function(err){b.disabled=false;b.textContent="Send";\n' +
      '    e.textContent=(err&&err.message&&err.message!=="failed")?err.message:"Could not send just now — please try again.";});\n' +
      '});\n})();\n<\/script>\n</body>\n</html>';
  }

  w.LEADFORM = { render: render, DEMO: DEMO, consentText: consentText, a2pPack: a2pPack, audit: audit, slugify: slugify };
})(window);
