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
      Cookie: cookie
    }),
    successCode: "0",
    parseResult: async (res) => {
      const json = await res.json();
      if (json.code === "0") return { ok: true, msg: json.message };
      return json.message === "今天已经签过啦！"
        ? { ok: true, msg: json.message }
        : { ok: false, msg: json.message };
    }
  },

  binmt: {
    name: "BinMT",
    signUrl:
      "https://www.binmt.cc/plugin.php?id=k_misign:sign&operation=qiandao&format=json",
    method: "GET",
    headers: (cookie) => ({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      Cookie: cookie
    }),
    parseResult: async (res) => {
      const json = await res.json();
      if (json.status === 0) return { ok: true, msg: json.msg };
      if (json.msg?.includes("已签到")) return { ok: true, msg: json.msg };
      return { ok: false, msg: json.msg || "签到失败" };
    }
  }
};

// =======================
// 执行签到
// =======================

async function checkIn(account) {
  const siteCfg = sites[account.site];

  if (!siteCfg) {
    throw new Error(`未知站点：${account.site}`);
  }

  console.log(`【${account.name} | ${siteCfg.name}】: 开始签到...`);

  const response = await fetch(siteCfg.signUrl, {
    method: siteCfg.method,
    headers: siteCfg.headers(account.cookie)
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
  let accounts;

  if (process.env.ACCOUNTS) {
    try {
      accounts = JSON.parse(process.env.ACCOUNTS);
    } catch (error) {
      console.log("❌ ACCOUNTS 格式错误");
      process.exit(1);
    }
  } else {
    console.log("❌ 未配置 ACCOUNTS");
    process.exit(1);
  }

  const all = accounts.map(checkIn);
  const results = await Promise.allSettled(all);

  console.log(`\n======== 签到结果 ========\n`);
  let hasError = false;

  results.forEach((result, index) => {
    const acc = accounts[index];
    if (result.status === "fulfilled") {
      console.log(`【${acc.name} | ${acc.site}】: ✅ ${result.value}`);
    } else {
      console.error(`【${acc.name} | ${acc.site}】: ❌ ${result.reason.message}`);
      hasError = true;
    }
  });

  if (hasError) process.exit(1);
}

main();
