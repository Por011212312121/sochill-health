/* Shared shop profiles on Supabase. There is no login: anyone with the link can read and change every profile. */
(() => {
  'use strict';
  const config = window.SOCHILL_CLOUD;
  if (!config?.enabled) return;
  const app = window.sochillProfile;
  const main = document.querySelector('main');
  const host = document.createElement('section');
  host.className = 'box cloud-box';
  host.innerHTML = `<h2>โปรไฟล์ลูกค้า · SoChill</h2>
    <div class="actions"><button id="newCustomer">+ ลูกค้าใหม่</button><button id="saveCustomer" class="primary">บันทึกโปรไฟล์</button><button id="deleteCustomer" class="secondary" disabled>ลบลูกค้าคนนี้</button></div>
    <p id="currentCustomer">ลูกค้าใหม่ · ยังไม่ได้บันทึก</p>
    <label for="customerSearch">ค้นหาด้วยชื่อเล่น</label><div class="actions"><input id="customerSearch" placeholder="ชื่อเล่นลูกค้า"><button id="searchCustomers">ค้นหา / รีเฟรชรายชื่อ</button></div>
    <div id="customerList"></div><p id="cloudStatus" role="status" aria-live="polite"></p>`;
  main.before(host);
  const $ = id => document.getElementById(id);
  let current = null, clean = '', busy = false;
  const status = text => { $('cloudStatus').textContent = text; };
  const snapshot = () => JSON.stringify(app.get());
  const dirty = () => snapshot() !== clean;
  const mayLeave = () => !dirty() || confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากโปรไฟล์นี้หรือไม่?');
  function lock(value) {
    busy = value;
    host.querySelectorAll('button').forEach(b => { b.disabled = value; });
    $('deleteCustomer').disabled = value || !current;
  }
  async function api(path, options = {}) {
    const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json', ...(options.headers || {}) };
    let response;
    try { response = await fetch(config.url.replace(/\/$/, '') + path, { ...options, headers, cache: 'no-store' }); }
    catch { throw Error('เชื่อมต่อไม่ได้ ข้อมูลยังไม่ถูกบันทึก กรุณาลองอีกครั้ง'); }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw Error('ดำเนินการไม่สำเร็จ ข้อมูลยังไม่ถูกบันทึก กรุณาลองอีกครั้ง');
    return payload;
  }
  async function run(work) { if (busy) return; lock(true); try { await work(); } catch (e) { status(e.message); } finally { lock(false); } }
  async function list() {
    const query = new URLSearchParams({ select: 'id,nickname,updated_at', order: 'updated_at.desc', limit: '100' });
    const term = $('customerSearch').value.trim();
    if (term) query.set('nickname', 'ilike.*' + term.replace(/[%*_]/g, '') + '*');
    const rows = await api('/rest/v1/sochill_profiles?' + query);
    $('customerList').replaceChildren();
    for (const row of rows) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = row.nickname + ' · ' + new Date(row.updated_at).toLocaleString('th-TH');
      button.addEventListener('click', () => run(async () => {
        if (!mayLeave()) return;
        const result = await api('/rest/v1/sochill_profiles?id=eq.' + encodeURIComponent(row.id) + '&select=*');
        if (!result.length) { await list(); throw Error('โปรไฟล์นี้ถูกลบไปแล้ว'); }
        current = result[0]; app.set(current.profile); clean = snapshot();
        $('currentCustomer').textContent = 'กำลังแก้ไข: ' + current.nickname;
        status('เปิดโปรไฟล์แล้ว แก้ไขและกดบันทึกเมื่อเสร็จ');
      }));
      $('customerList').append(button);
    }
    if (!rows.length) $('customerList').textContent = 'ยังไม่พบลูกค้า';
    if (rows.length === 100) status('แสดง 100 รายชื่อล่าสุด พิมพ์ชื่อเล่นเพื่อค้นหาคนอื่น');
  }
  $('searchCustomers').addEventListener('click', () => run(list));
  $('newCustomer').addEventListener('click', () => { if (busy || !mayLeave()) return; current = null; app.clear(); clean = snapshot(); $('currentCustomer').textContent = 'ลูกค้าใหม่ · ยังไม่ได้บันทึก'; $('deleteCustomer').disabled = true; status('กรอกข้อมูลแล้วกดบันทึกโปรไฟล์'); });
  $('saveCustomer').addEventListener('click', () => run(async () => {
    const profile = app.get(), nickname = (profile.nick || '').trim();
    if (!nickname || nickname.length > 100) throw Error('กรุณากรอกชื่อเล่น ไม่เกิน 100 ตัวอักษร');
    const body = { nickname, profile };
    const path = current ? '/rest/v1/sochill_profiles?id=eq.' + current.id + '&revision=eq.' + current.revision : '/rest/v1/sochill_profiles';
    const rows = await api(path, { method: current ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
    if (!rows?.length) throw Error('โปรไฟล์ถูกแก้ไขหรือลบจากอีกเครื่องแล้ว กรุณาเปิดรายชื่อนี้ใหม่ก่อนบันทึก');
    current = rows[0]; clean = JSON.stringify(profile); $('currentCustomer').textContent = 'กำลังแก้ไข: ' + current.nickname;
    status('บันทึกในฐานข้อมูลร้านแล้ว'); await list();
  }));
  $('deleteCustomer').addEventListener('click', () => run(async () => {
    if (!current || !confirm('ลบโปรไฟล์ “' + current.nickname + '” ออกจากฐานข้อมูลร้าน? ไม่มีถังขยะในระบบ')) return;
    const rows = await api('/rest/v1/sochill_profiles?id=eq.' + current.id + '&revision=eq.' + current.revision, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    if (!rows?.length) throw Error('ข้อมูลเปลี่ยนจากอีกเครื่องแล้ว กรุณาเปิดโปรไฟล์ใหม่ก่อนลบ');
    current = null; app.clear(); clean = snapshot(); $('currentCustomer').textContent = 'ลูกค้าใหม่ · ยังไม่ได้บันทึก';
    status('ลบโปรไฟล์ออกจากฐานข้อมูลร้านแล้ว'); await list();
  }));
  window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current && !busy) run(async () => {
    const rows = await api('/rest/v1/sochill_profiles?id=eq.' + current.id + '&select=id');
    if (!rows.length) { current = null; app.clear(); clean = snapshot(); $('currentCustomer').textContent = 'โปรไฟล์เดิมถูกลบแล้ว'; status('โปรไฟล์นี้ถูกลบจากอีกเครื่องแล้ว'); await list(); }
  }); });
  if (!app || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url) || !config.publishableKey) { status('ยังตั้งค่าฐานข้อมูลไม่ครบ'); return; }
  clean = snapshot();
  run(list);
})();
