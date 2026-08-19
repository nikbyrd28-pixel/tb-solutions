const fs = require('fs');
const h = fs.readFileSync('kit/targets/index.html', 'utf8');
const i = h.indexOf('var SHOPS=[');
const start = h.indexOf('[', i);
const end = h.indexOf('\n  ];', start);
const arr = JSON.parse(h.slice(start, end + 4).replace(/\];\s*$/, ']'));
console.error('parsed ' + arr.length + ' shops');
const q = s => (s === null || s === undefined || s === '') ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const seen = new Set();
const rows = arr.map(s => {
  let sl = slug(s[0]), n = 1;
  while (seen.has(sl)) { n++; sl = slug(s[0]) + '-' + n; }
  seen.add(sl);
  // SHOPS = [name, town, address, instagram, phone, angle, rank]
  return '  (' + [q(sl), q(s[0]), q(s[1]), q(s[2]), q(s[4]), q(s[3]), q(s[5]), String(s[6] || 0)].join(', ') + ')';
});
fs.writeFileSync(process.argv[2],
  'insert into public.loop_crm (slug, name, town, address, phone, instagram, angle, rank) values\n'
  + rows.join(',\n') + '\non conflict (slug) do nothing;\n');
console.error('wrote ' + rows.length + ' rows');
