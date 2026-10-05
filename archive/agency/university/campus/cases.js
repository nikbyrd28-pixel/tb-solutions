/* ============================================================================
   CASE FILES — five-minute stories with one usable lesson each
   ----------------------------------------------------------------------------
   Lessons teach the system. Stories teach the instinct. These are short
   retellings of real, documented episodes from business and tech — each ends
   in one move the student can make this week, because a story that changes
   nothing is entertainment.

   Rules for adding one: it must be TRUE and checkable (no legends, no
   misattributed quotes — that standard got set in Unschool and holds here),
   it must be tellable in five minutes, and the "move" must be something a
   solo local operator can actually do. One rotates onto the home screen each
   week alongside the build brief.
   ============================================================================ */
(function (w) {
  'use strict';

  w.TBU_CASES = [
    { id: 'kodak', tag: 'business', title: 'Kodak invented the thing that killed it',
      story: 'In 1975 a Kodak engineer, Steve Sasson, built the first digital camera — inside Kodak. Management saw it, understood it, and shelved it, because film was where the margins were. They were not stupid; they were protecting the thing that paid the bills. Thirty years later the thing they protected was worthless and the thing they shelved was the industry.',
      lesson: 'The danger is never the new thing. It is the margin you are protecting from it.',
      move: 'Name the one thing in your business you would refuse to cannibalise — then ask what happens if a competitor does not share your reluctance.' },
    { id: 'blockbuster', tag: 'business', title: 'Blockbuster laughed at the offer',
      story: 'In 2000 Netflix offered itself to Blockbuster for $50 million. Blockbuster passed — Netflix was a niche DVD-mail outfit, and Blockbuster had late fees, which were nearly pure profit. That is the detail worth keeping: late fees were revenue extracted from customers being punished. Netflix built its whole model on removing the punishment. Customers noticed.',
      lesson: 'Revenue your customers resent is a debt, not an asset. Somebody will build a business out of removing it.',
      move: 'Find the thing customers in your niche quietly resent paying — no-show fees, booking apps, call-out charges — and build your pitch around its removal.' },
    { id: 'airbnb-cereal', tag: 'startup', title: 'The cereal boxes that saved Airbnb',
      story: 'In 2008 Airbnb was broke and nobody would fund air mattresses in strangers\' flats. During the election the founders designed novelty cereal boxes — Obama O\'s and Cap\'n McCain\'s — hand-glued them, and sold them at $40 a box. It made about $30,000, kept the company alive, and convinced Paul Graham to let them into Y Combinator: not because cereal was a business, but because people this resourceful do not die easily.',
      lesson: 'Resourcefulness is the credential. Nobody funds, hires or refers the person waiting for conditions to improve.',
      move: 'You need money this month, not this quarter. Write down the fastest $500 you could generate with what is already in your hands — then do it instead of admiring it.' },
    { id: 'fedex-watch', tag: 'business', title: 'The $5,000 blackjack flight',
      story: 'In 1974 FedEx was down to about $5,000 and could not fuel its planes on Monday. Founder Fred Smith flew to Las Vegas, played blackjack with the last of it, and came back with $27,000 — enough to fly one more week. That week a funding round closed. The gamble is not the lesson; do not gamble payroll. The lesson is that he treated survival as the only job until it was handled.',
      lesson: 'When the business is dying, everything that is not survival is a hobby. Most people polish hobbies while the patient bleeds.',
      move: 'If revenue stopped today, how many weeks do you have? Know that number cold, and let it decide what tomorrow morning is spent on.' },
    { id: 'wozjobs', tag: 'tech', title: 'One built it, one sold it',
      story: 'Steve Wozniak built the Apple I and wanted to give the design away free at the Homebrew Computer Club — he was an engineer, and sharing was the culture. Steve Jobs insisted they sell it. Neither instinct alone becomes Apple: the giver never builds a company, the seller has nothing to sell. Every one-person business has to be both people on alternating days.',
      lesson: 'Building and selling are different jobs and you have both of them. The one you avoid is the one that caps your income.',
      move: 'Look at last week honestly: were you Woz all week? Book two hours of pure Jobs — outreach, follow-up, asking for money — before anything else gets built.' },
    { id: 'ford-500', tag: 'history', title: 'The $5 day',
      story: 'In 1914 Ford doubled factory pay to $5 a day. The press called it charity or madness. It was neither: turnover was so high Ford was training four workers to keep one, and the maths of retention beat the maths of cheap labour. Applications flooded in, turnover collapsed, and the assembly line finally ran at full speed.',
      lesson: 'Churn has a price tag even when it is not printed anywhere. Paying to keep people — staff or customers — is usually cheaper than paying to replace them.',
      move: 'Price your niche\'s churn: what does one lost regular cost a shop over a year? Put that number in your pitch — it sells retention better than any feature.' },
    { id: 'colonel', tag: 'persistence', title: 'A franchise built at 65',
      story: 'Harland Sanders was 65, running a service station café that a new interstate had just bypassed, living substantially on a small pension. He spent years driving to restaurants, cooking his chicken for owners, and signing them one handshake at a time — famously refused over and over before Pete Harman\'s Utah restaurant became the first real franchise. By the time he sold KFC in 1964 there were more than 600.',
      lesson: 'The pipeline does not care how old you are or how many nos are behind you. It only counts the asks.',
      move: 'Count your actual asks this month — not posts, not plans, direct asks where a no was possible. If it is under 20, that is the whole diagnosis.' },
    { id: 'zappos-shoes', tag: 'startup', title: 'Zappos faked the warehouse',
      story: 'In 1999 Nick Swinmurn tested whether anyone would buy shoes online by photographing pairs in local shoe shops and posting them for sale. When an order came in, he bought the pair at retail and shipped it himself — losing money on every sale, on purpose. He was not building a business yet; he was buying proof. The proof raised the money that built the warehouse.',
      lesson: 'Test the demand with your hands before you build the machine. Losing $20 to learn the truth is the cheapest research that exists.',
      move: 'Before building any new offer, sell it manually to one real customer — even at a loss. What you learn in that one transaction outweighs a month of planning.' },
    { id: 'patagonia-ad', tag: 'marketing', title: '"Don\'t buy this jacket"',
      story: 'On Black Friday 2011 Patagonia ran a full-page New York Times ad telling people not to buy its own jacket, laying out the environmental cost of making one. Sales went up. Cynics said that was the plan. The more useful reading: it was the single most credible thing a company said that day, in a newspaper full of companies shouting BUY.',
      lesson: 'In a market where everyone is pushing, the credible voice is the one visibly willing to lose the sale.',
      move: 'Add one honest disqualifier to your pitch — "if your chairs are already full, do not hire me." Watch what it does to trust in the same conversation.' },
    { id: 'dominos-30', tag: 'marketing', title: 'Domino\'s sold the wait, not the pizza',
      story: 'Domino\'s did not grow by claiming better pizza — it mostly was not. It grew on "30 minutes or it\'s free": a promise about the customer\'s actual anxiety (hungry people hate uncertainty) that was specific, checkable, and carried its own penalty. The product was ordinary. The promise was not. (They later dropped the guarantee over delivery-driver safety — a real cost of a real promise.)',
      lesson: 'A specific promise about the customer\'s anxiety beats a vague claim about your quality.',
      move: 'Rewrite your offer as a checkable promise with a penalty you carry. "Report on the 1st, every month, or that month is free" costs little and says everything.' },
    { id: 'ballmer-iphone', tag: 'tech', title: 'Ballmer laughed at the iPhone',
      story: 'In 2007 Steve Ballmer — running Microsoft, one of the best-informed executives alive — laughed at the iPhone on camera: "$500? Fully subsidised? With a plan? That is the most expensive phone in the world, and it does not appeal to business customers because it does not have a keyboard." Every fact in that sentence was true. The conclusion was still one of the worst calls in business history.',
      lesson: 'You can be senior, informed, and factually correct — and still completely wrong, because you are scoring the new thing by the old thing\'s rules.',
      move: 'Take the tool or channel you have dismissed ("my customers are not on there") and spend one honest hour scoring it by its own rules instead of yours.' },
    { id: 'graham-scale', tag: 'startup', title: 'Do things that don\'t scale',
      story: 'Paul Graham\'s most-quoted essay tells founders to do, at the start, exactly what a big company cannot: recruit users one at a time, by hand, and make each one indecently happy. Airbnb\'s founders flew to New York to photograph hosts\' apartments themselves. Stripe\'s founders installed their own product on users\' laptops on the spot. The unscalable work is not a compromise on the way to the real business — early on, it IS the real business.',
      lesson: 'At your size, doing it by hand is not a weakness. It is the one advantage the big competitor cannot copy.',
      move: 'Pick one client or prospect this week and do something for them that could never scale — hand-deliver the report, shoot their content yourself, fix something free. Then watch what it does to referrals.' },
    { id: 'iceberg-lettuce', tag: 'persistence', title: '1,009 restaurant visits — the other reading',
      story: 'The Sanders story gets told as pure persistence, but the second half matters more: he did not repeat the same pitch 1,009 times. He cooked the chicken in front of them — a demonstration, not a description — and he adjusted the deal, the territory and the terms restaurant by restaurant. Persistence without iteration is just repetition with a calendar.',
      lesson: 'Volume only compounds when each attempt learns from the last. A hundred identical attempts is one attempt, a hundred times.',
      move: 'After every ten outreach messages, change exactly one thing — the first line, the sample, the ask — and note what the change did. Ten becomes an experiment instead of a chore.' }
  ];

  /* One rotates onto home each week, offset from the build brief so the two
     never feel like the same slot. */
  w.TBU_caseForWeek = function (dt) {
    var d0 = dt || new Date();
    var start = new Date(d0.getFullYear(), 0, 1);
    var week = Math.floor(((d0 - start) / 86400000 + start.getDay() + 1) / 7);
    return w.TBU_CASES[(week + 3) % w.TBU_CASES.length];
  };
})(window);
