const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = __dirname;
const src = path.join(root, 'src');
const html = fs.readFileSync(path.join(src, 'vndb_tool.html'), 'utf8');
const main = fs.readFileSync(path.join(src, 'main.js'), 'utf8');
const multiRef = fs.readFileSync(path.join(src, 'multi_mode.js'), 'utf8');
const releaseRef = fs.readFileSync(path.join(src, 'release_mode.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'));

for (const [name, code] of [['main.js', main], ['multi_mode.js', multiRef], ['release_mode.js', releaseRef]]) {
  new vm.Script(code, { filename: name });
}

assert.equal(pkg.version, '1.4.0');
assert.ok(main.includes('app.requestSingleInstanceLock()'));
assert.ok(main.includes('입력 순서와 줄 수를 반드시 유지한다'));
assert.ok(html.includes('localStorage.getItem("img_save_path")'));
assert.ok(html.includes('localStorage.setItem("img_save_path", imgSavePath)'));
assert.ok(!html.includes('세션마다 초기화'));
assert.ok((html.match(/tags\.id/g) || []).length >= 3);
assert.ok(!html.includes('tagStr.split'));

const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx = vm.createContext({
  window: { addEventListener() {} },
  console,
  Blob,
  localStorage: { getItem() { return null; }, setItem() {} },
  document: { getElementById() { return { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} }, value: '' }; } },
  navigator: { clipboard: { write: async () => {} } },
  ClipboardItem: class { constructor(data) { this.data = data; } }
});
vm.runInContext(script, ctx);

const rawTags = [
  { id: 'g123', name: 'Yamato Nadeshiko Heroine' },
  { id: 'g456', name: 'Adult Heroine' }
];
const tagHtml = ctx.buildTagHtml(rawTags, '야마토 나데시코 히로인\n성인 히로인');
assert.ok(tagHtml.includes('href="https://vndb.org/g123"'));
assert.ok(tagHtml.includes('Yamato Nadeshiko Heroine'));
assert.ok(tagHtml.includes('(야마토 나데시코 히로인)'));
assert.ok(tagHtml.includes('href="https://vndb.org/g456"'));
assert.ok(ctx.buildTagHtml(rawTags, '').includes('Yamato Nadeshiko Heroine'));

const single = ctx.buildHtml(
  'https://vndb.org/v1', 'Original', 'Developer', '[JP] Publisher', 'Alias',
  80, 10, 2, 120, '<p>Description</p>', '18+', tagHtml
);
assert.ok(single.includes('<details><summary>스포 주의'));
assert.ok(single.includes('<details open=""><summary><b>게임 개요(VNDB)</b>'));
assert.ok(!single.includes('[이미지]'));
assert.ok(single.startsWith('<p><br></p>\n<table>'));
assert.ok(!single.includes('<hr>\n\n＊한패출처'));
assert.ok(single.includes('</details>\n<p><br></p>\n<br>\n<b>📌 한패출처 :</b>'));
assert.ok(single.endsWith('<b>🔗 링크 :</b>\n<hr>\n<p><br></p>\n<br>'));
assert.ok(!single.includes('＊한패출처'));
assert.ok(!single.includes('＊링크'));
assert.ok(!single.endsWith('<p><br></p>\n<p><br></p>'));

const vn = { id: 'v1', title: 'VN', alttitle: 'Original', rating: 80, votecount: 10, tags: rawTags };
const release = {
  title: 'Release', alttitle: 'Release original', released: '2026-01-01', minage: 18,
  languages: [{ lang: 'ja' }], producers: [{ name: 'Publisher', publisher: true }], vns: [vn]
};
const releaseHtml = ctx.buildReleaseHtml('r1', release, 'Developer', '18+', tagHtml, '<p>Description</p>');
assert.ok(releaseHtml.includes('<details open=""><summary><b>게임 개요(VNDB)</b>'));
assert.ok(!releaseHtml.includes('[이미지]'));
assert.ok(releaseHtml.startsWith('<p><br></p>\n<table>'));
assert.ok(!releaseHtml.includes('<hr>\n\n＊한패출처'));
assert.ok(releaseHtml.includes('</details>\n<p><br></p>\n<br>\n<b>📌 한패출처 :</b>'));
assert.ok(releaseHtml.endsWith('<b>🔗 링크 :</b>\n<hr>\n<p><br></p>\n<br>'));
assert.ok(!releaseHtml.includes('＊한패출처'));
assert.ok(!releaseHtml.includes('＊링크'));
assert.ok(!releaseHtml.endsWith('<p><br></p>\n<p><br></p>'));

const multiHtml = ctx.buildMultiGameTable('v1', vn, tagHtml, 'https://vndb.org/v1') + '\n\n🔗 링크 :\n<hr>\n<p><br></p>';
assert.ok(multiHtml.includes('🔗 링크 :'));
assert.ok(!multiHtml.includes('＊ 링크 :'));

for (const refCode of [multiRef, releaseRef]) {
  const ref = vm.createContext({});
  vm.runInContext(refCode, ref);
  for (const name of Object.keys(ref)) {
    if (typeof ref[name] === 'function' && typeof ctx[name] === 'function') {
      assert.equal(ref[name].toString().replace(/\s+/g, ''), ctx[name].toString().replace(/\s+/g, ''), `${name} reference parity`);
    }
  }
}

console.log('PASS: v1.4 syntax, saved image folder, linked original tags, open overview, and footer layout.');
