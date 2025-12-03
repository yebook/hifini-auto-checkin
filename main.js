// =======================
// 配置每个站点的签到策略
// =======================

const sites = {
  hifiti: {
    name: "HiFiTi",
    signUrl: "https://www.hifiti.com/sg_sign.htm",
    method: "POST",
    headers: (cookie) => ({
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      Cookie: cookie,
    }),
    successCode: "0",
    parseResult: async (res) => {
      const json = await res.json();
      if (json.code === "0") return { ok: true, msg: json.message };
      return json.message === "今天已经签过啦！"
        ? { ok: true, msg: json.message }
        : { ok: false, msg: json.message };
    },
  },

  binmt: {
    name: "BinMT",
    preUrl: "https://bbs.binmt.cc/k_misign-sign.html",
    signUrl:
      "https://bbs.binmt.cc/plugin.php?id=k_misign:sign&operation=qiandao&infloat=1&inajax=1&ajaxtarget=midaben_sign",
    method: "GET",
    headers: (cookie) => ({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://bbs.binmt.cc/k_misign-sign.html",
      Cookie: cookie,
    }),
    parseResult: async (res) => {
      const text = await res.text();
      console.log(`【MT签到返回】: ${text}`);
      if (text.startsWith("<")) {
        // 尝试从 HTML 中提取提示
        const match = text.match(
          /<div[^>]*class="bm_c"[^>]*>([\s\S]*?)<\/div>/i
        );
        if (match && match[1]) {
          const msg = match[1].trim();
          if (msg.includes("已签到") || msg.includes("今天已经签过")) {
            return { ok: true, msg };
          } else {
            return { ok: false, msg };
          }
        }
        return {
          ok: false,
          msg: "返回 HTML 页面，Cookie 失效或未登录",
        };
      }

      try {
        const json = JSON.parse(text);
        if (json.status === 0) return { ok: true, msg: json.msg };
        if (json.msg?.includes("已签到")) return { ok: true, msg: json.msg };
        return { ok: false, msg: json.msg || "签到失败" };
      } catch (err) {
        return { ok: false, msg: "返回内容无法解析为 JSON" };
      }
    },
  },
};

// =======================
// 执行签到
// =======================

async function checkIn(account, siteKey) {
  const siteCfg = sites[siteKey];

  if (!siteCfg) {
    throw new Error(`未知站点：${siteKey}`);
  }

  console.log(`【${account.name} | ${siteCfg.name}】: 开始签到...`);

  // 如果有 preUrl，先访问一次
  if (siteCfg.preUrl) {
    await fetch(siteCfg.preUrl, {
      method: "GET",
      headers: siteCfg.headers(account.cookie),
    });
  }

  const response = await fetch(siteCfg.signUrl, {
    method: siteCfg.method,
    headers: siteCfg.headers(account.cookie),
  });

  if (!response.ok) {
    throw new Error(`网络错误：${response.status}`);
  }

  const result = await siteCfg.parseResult(response);

  if (result.ok) {
    console.log(`【${account.name}】签到成功：${result.msg}`);
    return result.msg;
  } else {
    throw new Error(result.msg);
  }
}

// =======================
// 主流程
// =======================

async function main() {
  // 处理 HiFiTi 账号
  let hifitiAccounts = [];
  if (process.env.ACCOUNTS) {
    try {
      hifitiAccounts = JSON.parse(process.env.ACCOUNTS);
    } catch (err) {
      console.log("❌ ACCOUNTS 格式错误");
      process.exit(1);
    }
  }

  // 处理 MT 账号
  let mtAccounts = [];
  if (process.env.MT_ACCOUNTS) {
    try {
      mtAccounts = JSON.parse(process.env.MT_ACCOUNTS);
    } catch (err) {
      console.log("❌ MT_ACCOUNTS 格式错误");
      process.exit(1);
    }
  }

  const tasks = [
    ...hifitiAccounts.map((acc) => checkIn(acc, "hifiti")),
    ...mtAccounts.map((acc) => checkIn(acc, "binmt")),
  ];

  if (tasks.length === 0) {
    console.log("❌ 未配置任何账号信息");
    process.exit(1);
  }

  const results = await Promise.allSettled(tasks);

  console.log(`\n======== 签到结果 ========\n`);
  let hasError = false;

  let allAccounts = [
    ...hifitiAccounts.map((a) => ({ ...a, site: "hifiti" })),
    ...mtAccounts.map((a) => ({ ...a, site: "binmt" })),
  ];

  results.forEach((result, index) => {
    const acc = allAccounts[index];
    if (result.status === "fulfilled") {
      console.log(`【${acc.name} | ${acc.site}】: ✅ ${result.value}`);
    } else {
      console.error(
        `【${acc.name} | ${acc.site}】: ❌ ${result.reason.message}`
      );
      hasError = true;
    }
  });

  if (hasError) process.exit(1);
}

main();
