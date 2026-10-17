export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const db = env.DB;

    try {
      // ====== GET /stats ======
      if (path === '/stats' && request.method === 'GET') {
        const total = await db.prepare('SELECT COUNT(*) as count FROM coupons').first('count');
        const available5 = await db.prepare('SELECT COUNT(*) as count FROM coupons WHERE used = 0 AND value = 5').first('count');
        const available3 = await db.prepare('SELECT COUNT(*) as count FROM coupons WHERE used = 0 AND value = 3').first('count');
        const used = await db.prepare('SELECT COUNT(*) as count FROM coupons WHERE used = 1').first('count');
        const userCount = await db.prepare('SELECT COUNT(DISTINCT username) as count FROM records WHERE strftime("%Y-%m", time) = strftime("%Y-%m", "now")').first('count');

        return json({ total, available5, available3, used, userCount }, corsHeaders);
      }

      // ====== GET /coupons ======
      if (path === '/coupons' && request.method === 'GET') {
        const { results } = await db.prepare('SELECT id, code, value, used FROM coupons ORDER BY used ASC, id DESC').all();
        return json({ coupons: results || [] }, corsHeaders);
      }

      // ====== POST /coupons ======
      if (path === '/coupons' && request.method === 'POST') {
        const body = await request.json();
        const { codes, value } = body;
        if (!codes || !Array.isArray(codes) || codes.length === 0) {
          return json({ error: '请提供优惠券编码数组' }, corsHeaders, 400);
        }

        let added = 0;
        for (const code of codes) {
          const trimmed = String(code).trim();
          if (!trimmed) continue;
          try {
            await db.prepare('INSERT INTO coupons (code, value, used) VALUES (?, ?, 0)').bind(trimmed, value || 3).run();
            added++;
          } catch (e) {
            // duplicate code, ignore
          }
        }
        return json({ added, message: `成功导入 ${added} 个${value || 3}元优惠券` }, corsHeaders);
      }

      // ====== DELETE /coupons ======
      if (path === '/coupons' && request.method === 'DELETE') {
        const body = await request.json();
        const { id } = body;
        if (!id) return json({ error: '缺少id' }, corsHeaders, 400);
        await db.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run();
        return json({ ok: true }, corsHeaders);
      }

      // ====== POST /draw ======
      if (path === '/draw' && request.method === 'POST') {
        const body = await request.json();
        const { username } = body;
        if (!username) return json({ error: '请输入邮箱' }, corsHeaders, 400);

        const email = String(username).trim().toLowerCase();
        const yearMonth = new Date().toISOString().slice(0, 7);

        // Check if already played this month
        const existing = await db.prepare(
          'SELECT code, value, time FROM records WHERE username = ? AND strftime("%Y-%m", time) = ?'
        ).bind(email, yearMonth).first();

        if (existing) {
          return json({
            error: 'already_played',
            record: { code: existing.code, value: existing.value, time: existing.time },
            message: '该邮箱本月已参与过抽奖'
          }, corsHeaders);
        }

        // Get available coupons
        const { results: available } = await db.prepare(
          'SELECT id, code, value FROM coupons WHERE used = 0'
        ).all();

        if (!available || available.length === 0) {
          return json({ error: 'empty', message: '优惠券已被抽完' }, corsHeaders);
        }

        // Random winner
        const winner = available[Math.floor(Math.random() * available.length)];

        // Mark as used
        await db.prepare('UPDATE coupons SET used = 1 WHERE id = ?').bind(winner.id).run();

        // Create record
        const now = new Date().toISOString();
        await db.prepare(
          'INSERT INTO records (username, code, value, time) VALUES (?, ?, ?, ?)'
        ).bind(email, winner.code, winner.value, now).run();

        return json({ ok: true, code: winner.code, value: winner.value, time: now }, corsHeaders);
      }

      // ====== POST /check ======
      if (path === '/check' && request.method === 'POST') {
        const body = await request.json();
        const { username } = body;
        if (!username) return json({ error: '请输入邮箱' }, corsHeaders, 400);

        const email = String(username).trim().toLowerCase();
        const yearMonth = new Date().toISOString().slice(0, 7);

        const existing = await db.prepare(
          'SELECT code, value, time FROM records WHERE username = ? AND strftime("%Y-%m", time) = ?'
        ).bind(email, yearMonth).first();

        if (existing) {
          return json({ ok: true, hasPlayed: true, record: { code: existing.code, value: existing.value, time: existing.time } }, corsHeaders);
        }
        return json({ ok: true, hasPlayed: false }, corsHeaders);
      }

      // ====== GET /records ======
      if (path === '/records' && request.method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM records ORDER BY time DESC').all();
        return json({ records: results || [] }, corsHeaders);
      }

      // ====== DELETE /all ======
      if (path === '/all' && request.method === 'DELETE') {
        await db.prepare('DELETE FROM coupons').run();
        await db.prepare('DELETE FROM records').run();
        return json({ ok: true, deletedCoupons: 0, deletedRecords: 0 }, corsHeaders);
      }

      // ====== POST /admin/login ======
      if (path === '/admin/login' && request.method === 'POST') {
        const body = await request.json();
        const { password } = body;
        const setting = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('admin_pwd').first();
        const storedPwd = setting ? setting.value : 'cyber888';
        if (password === storedPwd) {
          return json({ ok: true, token: 'admin_' + Date.now() }, corsHeaders);
        }
        return json({ ok: false, message: '密码错误' }, corsHeaders, 403);
      }

      // ====== POST /admin/password ======
      if (path === '/admin/password' && request.method === 'POST') {
        const body = await request.json();
        const { oldPassword, newPassword } = body;
        const setting = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('admin_pwd').first();
        const storedPwd = setting ? setting.value : 'cyber888';
        if (oldPassword !== storedPwd) {
          return json({ ok: false, message: '原密码错误' }, corsHeaders, 403);
        }
        await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind('admin_pwd', newPassword).run();
        return json({ ok: true, message: '密码修改成功' }, corsHeaders);
      }

      return json({ error: 'Not Found' }, corsHeaders, 404);

    } catch (err) {
      console.error('API Error:', err);
      return json({ error: 'Internal Server Error', message: err.message }, corsHeaders, 500);
    }
  }
};

function json(data, headers, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}
