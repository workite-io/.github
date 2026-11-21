(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionToggle = document.querySelector("#motion-toggle");
  let motionPaused = reducedMotion.matches;
  let manualMotionPreference = false;
  let demoTimer = null;
  let demoAutoplayRequested = true;
  let demoInView = false;
  let demoReady = false;
  let lifecycleTimer = null;
  let toastTimer = null;

  const header = document.querySelector(".site-header");
  const updateHeaderHeight = () => {
    document.documentElement.style.setProperty("--header-height", `${header.getBoundingClientRect().height}px`);
  };
  updateHeaderHeight();
  if ("ResizeObserver" in window) {
    new ResizeObserver(updateHeaderHeight).observe(header);
  } else {
    window.addEventListener("resize", updateHeaderHeight);
  }

  function stopDemo() {
    clearInterval(demoTimer);
    demoTimer = null;
    document.querySelector("#demo-play").innerHTML = reducedMotion.matches
      ? '<span aria-hidden="true">→</span><span>下一步</span>'
      : '<span aria-hidden="true">▷</span><span>播放演示</span>';
    document.querySelector("#demo-play").setAttribute("aria-pressed", "false");
    document.querySelector("#architecture-demo").dataset.playing = "false";
    document.querySelector(".demo-narrative > div").setAttribute("aria-live", "polite");
  }

  function stopLifecycle() {
    clearInterval(lifecycleTimer);
    lifecycleTimer = null;
    document.querySelector("#lifecycle-play").innerHTML = reducedMotion.matches
      ? '<span aria-hidden="true">→</span>下一任务状态'
      : '<span aria-hidden="true">▷</span>播放任务旅程';
    document.querySelector("#lifecycle-play").setAttribute("aria-pressed", "false");
    document.querySelector(".lifecycle-detail").setAttribute("aria-live", "polite");
  }

  function updateMotion() {
    document.documentElement.classList.toggle("motion-paused", motionPaused);
    motionToggle.setAttribute("aria-pressed", String(motionPaused));
    motionToggle.setAttribute("aria-label", motionPaused ? "恢复动态效果" : "暂停动态效果");
    motionToggle.querySelector(".motion-label").textContent = motionPaused ? "恢复动效" : "暂停动效";
    motionToggle.disabled = reducedMotion.matches;
    if (reducedMotion.matches) {
      motionToggle.setAttribute("aria-label", "系统已启用减少动态效果，使用步骤按钮静态浏览");
      motionToggle.querySelector(".motion-label").textContent = "静态浏览";
    }
    if (motionPaused || reducedMotion.matches) {
      stopDemo();
      stopLifecycle();
    } else if (demoReady) {
      startDemo();
    }
  }

  motionToggle.addEventListener("click", () => {
    manualMotionPreference = true;
    motionPaused = !motionPaused;
    updateMotion();
    announce(motionPaused ? "动态效果已暂停，可使用步骤按钮浏览演示。" : "动态效果已恢复。");
  });
  reducedMotion.addEventListener("change", () => {
    if (!manualMotionPreference) motionPaused = reducedMotion.matches;
    updateMotion();
  });
  updateMotion();

  // Reveal once; content stays readable if JavaScript or observers are unavailable.
  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    document.documentElement.classList.add("js");
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove("pending");
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach(element => {
      element.classList.add("pending");
      revealObserver.observe(element);
    });
  }

  const scenarios = {
    execution: [
      { label: "接入与路由", title: "流程，从统一入口出发。", description: "Client 创建流程实例，Gateway 按拓扑路由到目标分区的 Leader。示例使用 P3，Leader 位于 Broker 3。" },
      { label: "持久化与复制", title: "每一次状态变化，都有副本守护。", description: "流程命令与事件写入复制日志。分区内多数派提交后，已提交状态可在 Leader 切换后恢复。" },
      { label: "Worker 执行", title: "流程到达业务步骤，Worker 接手。", description: "Service Task 创建 Job。Worker 向 PD 注册，通过 Gateway 激活任务，在你的业务服务中执行。" },
      { label: "上报与继续", title: "任务完成，流程继续向前。", description: "Worker 通过 Gateway 上报结果。Broker 提交完成事件、更新流程状态，推进后续业务步骤。" }
    ],
    failover: [
      { label: "正常复制", title: "故障之前，状态已经复制。", description: "P1 的 Leader 位于 Broker 1。已提交日志被分区副本共同保存，为恢复提供基础。" },
      { label: "节点故障", title: "一个 Broker 离线，分区重新选主。", description: "Broker 1 离线，P1 暂时没有 Leader，请求短暂不可用。其余副本保留已提交的流程状态。" },
      { label: "选主与拓扑", title: "多数派选主，路由随之更新。", description: "剩余多数派选出新的 Leader，Gateway 同步最新拓扑，切换请求路由。" },
      { label: "恢复处理", title: "从已提交的状态，继续这段流程。", description: "请求转向 Broker 2 的新 Leader，流程恢复处理。Broker 1 仍离线，重新加入后可通过快照与日志同步恢复副本。" }
    ],
    scale: [
      { label: "准备容量", title: "让增长，有新的空间。", description: "准备新增 Broker 4，由控制面的变更计划协调分区迁移。Gateway 与 Worker 可分别扩展。" },
      { label: "注册与加入", title: "新节点注册，先成为 Learner。", description: "Broker 4 向 PD 注册，按变更计划加入目标分区，先以 Learner 复制状态，不直接参与选举。" },
      { label: "复制与追赶", title: "状态追平，才有资格接手。", description: "新节点以 Learner 身份同步日志，追赶已提交状态。PD 跟踪复制进度与实际角色。" },
      { label: "调整与分担", title: "准备就绪，再让负载流动。", description: "新节点追平后按计划晋升、迁移成员与 Leader，Gateway 同步拓扑。迁移期间的额外副本不代表永久增加副本因子。" }
    ]
  };
  let scenario = "execution";
  let demoStep = 0;
  const demo = document.querySelector("#architecture-demo");
  const demoPanel = document.querySelector("#architecture-panel");
  const stepContainer = document.querySelector("#demo-steps");
  const prev = document.querySelector("#demo-prev");
  const next = document.querySelector("#demo-next");
  const play = document.querySelector("#demo-play");

  // Anchor every connection to its actual component, including after font/viewport changes.
  // Workers have exactly two peers: Gateway for jobs, PD for registration and renewal.
  function updateTopologyWires() {
    const canvas = document.querySelector(".topology");
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const sx = 1200 / bounds.width;
    const sy = 720 / bounds.height;
    const box = selector => {
      const rect = canvas.querySelector(selector).getBoundingClientRect();
      return {
        x: (rect.left - bounds.left) * sx,
        y: (rect.top - bounds.top) * sy,
        w: rect.width * sx,
        h: rect.height * sy
      };
    };
    const client = box(".client-node");
    const gateway = box(".gateway-pool");
    const worker = box(".workers");
    const pd = box(".control-plane");
    const brokers = box(".data-plane");
    const topologyPort = gateway.x + gateway.w * .5;
    const workerPort = worker.x + worker.w * .5;
    const watchY = pd.y - 28 * sy;
    const pdPort = pd.x + pd.w * .76;
    // This link enters the cluster; partition roles show the current leader.
    // Keep its port stable so scenario changes do not move it across the topology watch.
    const brokerPort = brokers.x + brokers.w * .8;
    const registrationY = pd.y + pd.h * .42;
    const changeY = pd.y + pd.h * .75;
    const clientY = client.y + client.h * .5;
    const workerY = worker.y + worker.h * .5;
    const roundedPath = points => {
      let d = `M${points[0][0]} ${points[0][1]}`;
      for (let i = 1; i < points.length - 1; i++) {
        const [x, y] = points[i];
        const [px, py] = points[i - 1];
        const [nx, ny] = points[i + 1];
        const before = Math.hypot(x - px, y - py);
        const after = Math.hypot(nx - x, ny - y);
        if (!before || !after) continue;
        const radius = Math.min(16 * Math.min(sx, sy), before / 2, after / 2);
        const enter = [x - (x - px) / before * radius, y - (y - py) / before * radius];
        const exit = [x + (nx - x) / after * radius, y + (ny - y) / after * radius];
        d += `L${enter[0]} ${enter[1]}Q${x} ${y} ${exit[0]} ${exit[1]}`;
      }
      const last = points[points.length - 1];
      return `${d}L${last[0]} ${last[1]}`;
    };
    const connections = {
      "client-gateway": [[client.x + client.w, clientY], [gateway.x, clientY]],
      "gateway-broker": [[brokerPort, gateway.y + gateway.h], [brokerPort, brokers.y]],
      "gateway-pd": [[topologyPort, gateway.y + gateway.h], [topologyPort, watchY], [pdPort, watchY], [pdPort, pd.y]],
      "worker-gateway": [[worker.x + worker.w, workerY], [gateway.x, workerY]],
      "worker-pd": [[workerPort, worker.y + worker.h], [workerPort, pd.y]],
      "broker-pd": [[brokers.x, registrationY], [pd.x + pd.w, registrationY]],
      "pd-broker": [[pd.x + pd.w, changeY], [brokers.x, changeY]]
    };
    for (let partition = 1; partition <= 3; partition++) {
      for (let broker = 1; broker <= 2; broker++) {
        const from = box(`[data-partition="${partition}"][data-broker="${broker}"]`);
        const source = box(`#broker-${broker}`);
        const destination = box(`#broker-${broker + 1}`);
        connections[`replication-${partition}-${broker}`] = [
          [source.x + source.w, from.y + from.h / 2],
          [destination.x, from.y + from.h / 2]
        ];
      }
    }
    const shafts = {};
    const arrowLayer = canvas.querySelector(".topology-arrowheads");
    const arrows = document.createDocumentFragment();
    canvas.querySelectorAll(".wire-base path[data-link]").forEach(path => {
      if (!connections[path.dataset.link]) return;
      const points = connections[path.dataset.link].map(point => [...point]);
      const drawHead = (endpoint, neighbor, end) => {
        const dx = neighbor[0] - endpoint[0];
        const dy = neighbor[1] - endpoint[1];
        const distance = Math.hypot(dx, dy);
        const ux = dx / distance;
        const uy = dy / distance;
        const along = Math.abs(ux) * sx + Math.abs(uy) * sy;
        const across = Math.abs(uy) * sx + Math.abs(ux) * sy;
        const tip = [endpoint[0] + ux * 6 * along, endpoint[1] + uy * 6 * along];
        const base = [tip[0] + ux * 10 * along, tip[1] + uy * 10 * along];
        const halfWidth = 5 * across;
        const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
        head.dataset.arrowFor = path.dataset.link;
        head.dataset.end = end;
        head.setAttribute("class", `arrow-head${path.classList.contains("is-active-link") ? " is-active-link" : ""}`);
        head.setAttribute("d", `M${tip[0]} ${tip[1]}L${base[0] - uy * halfWidth} ${base[1] + ux * halfWidth}L${base[0] + uy * halfWidth} ${base[1] - ux * halfWidth}Z`);
        arrows.append(head);
        return base;
      };
      const inset = (endpoint, neighbor) => {
        const dx = neighbor[0] - endpoint[0];
        const dy = neighbor[1] - endpoint[1];
        const distance = Math.hypot(dx, dy);
        return [endpoint[0] + dx / distance * 6 * sx, endpoint[1] + dy / distance * 6 * sy];
      };
      const first = points[0];
      const last = points[points.length - 1];
      points[0] = path.hasAttribute("data-arrow-start") ? drawHead(first, points[1], "start") : inset(first, points[1]);
      points[points.length - 1] = path.hasAttribute("data-arrow-end") ? drawHead(last, connections[path.dataset.link].at(-2), "end") : inset(last, connections[path.dataset.link].at(-2));
      shafts[path.dataset.link] = roundedPath(points);
      path.setAttribute("d", shafts[path.dataset.link]);
    });
    arrowLayer.replaceChildren(arrows);
    canvas.querySelectorAll(".wire[data-link]").forEach(path => {
      const d = path.dataset.link === "replication"
        ? Object.entries(shafts).filter(([key]) => key.startsWith("replication-")).map(([, value]) => value).join("")
        : shafts[path.dataset.link];
      if (d) path.setAttribute("d", d);
    });
    const label = (selector, x, y, align = "center") => {
      const element = canvas.querySelector(selector);
      element.style.left = `${x / sx}px`;
      element.style.top = `${y / sy}px`;
      element.style.transform = align === "right" ? "translate(-100%, -100%)" : "translate(-50%, -100%)";
    };
    const apiX = (client.x + client.w + gateway.x) / 2;
    const controlX = (pd.x + pd.w + brokers.x) / 2;
    label(".client-api-label", apiX, clientY - 8 * sy);
    label(".worker-api-label", apiX, workerY - 8 * sy);
    label(".worker-registration-label", workerPort - 24 * sx, (worker.y + worker.h + pd.y) / 2, "right");
    label(".topology-sync", (topologyPort + pdPort) / 2, watchY - 8 * sy);
    label(".route-label", brokerPort - 24 * sx, (gateway.y + gateway.h + brokers.y) / 2, "right");
    label(".broker-registration-label", controlX, registrationY - 10 * sy);
    label(".topology-change-label", controlX, changeY - 10 * sy);
  }

  function renderDemoSteps() {
    stepContainer.replaceChildren();
    scenarios[scenario].forEach((step, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = step.label;
      button.setAttribute("aria-label", `第 ${index + 1} 步：${step.label}`);
      button.addEventListener("click", () => {
        demoAutoplayRequested = false;
        stopDemo();
        demoStep = index;
        renderDemo();
      });
      stepContainer.append(button);
    });
  }

  function renderDemo() {
    demo.dataset.scenario = scenario;
    demo.dataset.step = String(demoStep);
    const current = scenarios[scenario][demoStep];
    document.querySelector("#demo-title").textContent = current.title;
    document.querySelector("#demo-description").textContent = current.description;
    document.querySelector("#demo-counter").textContent = `${String(demoStep + 1).padStart(2, "0")} / 04`;
    prev.disabled = demoStep === 0;
    next.disabled = demoStep === 3;
    [...stepContainer.children].forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === demoStep));
    });
    document.querySelectorAll(".broker").forEach((broker, index) => {
      const offline = scenario === "failover" && demoStep >= 1 && index === 0;
      broker.classList.toggle("offline", offline);
      broker.querySelector(".broker-health").textContent = offline ? "离线" : "在线";
    });
    document.querySelectorAll(".partition").forEach(partition => {
      const partitionId = Number(partition.dataset.partition);
      const brokerId = Number(partition.dataset.broker);
      let leaderId = partitionId;
      if (scenario === "failover" && partitionId === 1 && demoStep >= 1) {
        leaderId = demoStep === 1 ? 0 : 2;
      }
      const offline = scenario === "failover" && demoStep >= 1 && brokerId === 1;
      const leader = !offline && brokerId === leaderId;
      partition.classList.toggle("leader", leader);
      partition.querySelector("b").textContent = offline ? "Offline" : leader ? "Leader" : "Follower";
    });
    const scaleLabels = ["准备加入", "Learner · 已注册", "Learner · 日志追赶", "已追平 · 按计划晋升"];
    document.querySelector("#scale-node b").textContent = scaleLabels[demoStep];
    const focus = {
      execution: [
        [".client-node", ".gateway-pool"],
        ["#broker-3", '[data-partition="3"]'],
        [".workers", ".gateway-pool", ".control-plane"],
        [".workers", ".gateway-pool", "#broker-3", '[data-partition="3"][data-broker="3"]']
      ],
      failover: [
        [".broker", ".partition"],
        [],
        [".control-plane", ".gateway-pool", "#broker-2", '[data-partition="1"][data-broker="2"]'],
        [".gateway-pool", "#broker-2", '[data-partition="1"][data-broker="2"]']
      ],
      scale: [
        [".scale-node"],
        [".scale-node", ".control-plane"],
        [".scale-node", ".broker", ".partition"],
        [".scale-node", ".control-plane", ".gateway-pool", ".extra-gateway"]
      ]
    };
    demo.querySelectorAll(".is-active").forEach(node => node.classList.remove("is-active"));
    focus[scenario][demoStep].forEach(selector => {
      demo.querySelectorAll(selector).forEach(node => node.classList.add("is-active"));
    });
    const links = {
      execution: [
        ["client-gateway", "gateway-broker"],
        ["replication"],
        ["worker-gateway", "worker-pd"],
        ["worker-gateway", "gateway-broker"]
      ],
      failover: [
        ["replication"],
        [],
        ["gateway-pd", "broker-pd"],
        ["gateway-broker"]
      ],
      scale: [
        [],
        ["broker-pd", "pd-broker"],
        ["replication"],
        ["gateway-pd", "pd-broker"]
      ]
    }[scenario][demoStep];
    demo.querySelectorAll("path[data-link]").forEach(path => {
      const key = path.dataset.link;
      path.classList.toggle("is-active-link", links.includes(key) || key.startsWith("replication-") && links.includes("replication"));
    });
    updateTopologyWires();
  }

  function startDemo() {
    if (!demoAutoplayRequested || !demoInView || motionPaused || reducedMotion.matches || document.hidden || demoTimer) return;
    play.innerHTML = '<span aria-hidden="true">Ⅱ</span><span>暂停演示</span>';
    play.setAttribute("aria-pressed", "true");
    demo.dataset.playing = "true";
    document.querySelector(".demo-narrative > div").setAttribute("aria-live", "off");
    demoTimer = setInterval(() => {
      demoStep = (demoStep + 1) % scenarios[scenario].length;
      renderDemo();
    }, 2800);
  }

  document.querySelectorAll("[data-scenario][role='tab']").forEach(tab => {
    tab.addEventListener("click", () => {
      stopDemo();
      scenario = tab.dataset.scenario;
      demoStep = 0;
      document.querySelectorAll("[data-scenario][role='tab']").forEach(item => {
        item.setAttribute("aria-selected", String(item === tab));
        item.tabIndex = item === tab ? 0 : -1;
      });
      demoPanel.setAttribute("aria-labelledby", tab.id);
      renderDemoSteps();
      renderDemo();
      // An explicit pause or manual step selection survives switching scenarios.
      const bounds = demo.getBoundingClientRect();
      demoInView = bounds.bottom > 0 && bounds.top < window.innerHeight;
      startDemo();
    });
  });
  prev.addEventListener("click", () => { demoAutoplayRequested = false; stopDemo(); demoStep = Math.max(0, demoStep - 1); renderDemo(); });
  next.addEventListener("click", () => { demoAutoplayRequested = false; stopDemo(); demoStep = Math.min(3, demoStep + 1); renderDemo(); });
  play.addEventListener("click", () => {
    if (demoTimer) { demoAutoplayRequested = false; stopDemo(); return; }
    if (motionPaused || reducedMotion.matches) {
      demoStep = (demoStep + 1) % 4;
      renderDemo();
      announce("当前减少动态效果，已切换到下一步骤。");
      return;
    }
    demoAutoplayRequested = true;
    startDemo();
  });
  renderDemoSteps();
  renderDemo();
  demoReady = true;
  if ("ResizeObserver" in window) {
    const topologyObserver = new ResizeObserver(updateTopologyWires);
    [".topology", ".gateway-pool", ".workers", ".control-plane", ".data-plane"].forEach(selector => {
      topologyObserver.observe(document.querySelector(selector));
    });
  } else {
    window.addEventListener("resize", updateTopologyWires);
  }

  const lifecycle = [
    { state: "CREATED", title: "流程到达任务节点，Job 随之创建。", description: "已激活的 Service Task 产生业务 Job，保存任务类型、变量与重试信息。任务创建来自流程执行。" },
    { state: "READY", title: "任务已就绪，等待合适的执行者。", description: "状态机保存可执行任务。Worker 按任务类型、租户与容量，通过 Gateway 请求激活。" },
    { state: "ACTIVATED", title: "业务执行，拥有明确的会话与期限。", description: "Worker 取得任务并执行处理逻辑。注册租约标识 Worker 会话，任务激活超时约束本次处理期限。" },
    { state: "COMPLETED", title: "任务完成，让流程向前一步。", description: "Worker 明确发送完成命令，可携带结果变量。Broker 提交完成事件并更新状态，推进 Service Task 后续步骤。" }
  ];
  let lifecycleStage = 0;
  const lifecycleButtons = [...document.querySelectorAll(".lifecycle-step")];
  const lifecyclePlay = document.querySelector("#lifecycle-play");
  function renderLifecycle() {
    const current = lifecycle[lifecycleStage];
    document.querySelector("#lifecycle-state").textContent = current.state;
    document.querySelector("#lifecycle-title").textContent = current.title;
    document.querySelector("#lifecycle-description").textContent = current.description;
    lifecycleButtons.forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === lifecycleStage));
      button.classList.toggle("current", index === lifecycleStage);
      button.classList.toggle("completed", index < lifecycleStage);
    });
  }
  lifecycleButtons.forEach(button => {
    button.addEventListener("click", () => {
      stopLifecycle();
      lifecycleStage = Number(button.dataset.stage);
      renderLifecycle();
    });
  });
  lifecyclePlay.addEventListener("click", () => {
    if (lifecycleTimer) { stopLifecycle(); return; }
    if (motionPaused || reducedMotion.matches) {
      lifecycleStage = (lifecycleStage + 1) % 4;
      renderLifecycle();
      announce("当前减少动态效果，已切换到下一任务状态。");
      return;
    }
    lifecycleStage = 0;
    renderLifecycle();
    lifecyclePlay.innerHTML = '<span aria-hidden="true">Ⅱ</span>暂停任务旅程';
    lifecyclePlay.setAttribute("aria-pressed", "true");
    document.querySelector(".lifecycle-detail").setAttribute("aria-live", "off");
    lifecycleTimer = setInterval(() => {
      if (document.hidden) return;
      lifecycleStage++;
      renderLifecycle();
      if (lifecycleStage === 3) stopLifecycle();
    }, 2200);
  });

  const codeTabs = [...document.querySelectorAll("[data-code]")];
  codeTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      codeTabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
        document.querySelector(`#code-${item.dataset.code}`).hidden = !selected;
      });
    });
  });

  // Standard tab-list keyboard navigation: arrows, Home and End.
  document.querySelectorAll("[role='tablist']").forEach(tablist => {
    tablist.addEventListener("keydown", event => {
      const tabs = [...tablist.querySelectorAll("[role='tab']")];
      const index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      let target;
      if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") target = 0;
      if (event.key === "End") target = tabs.length - 1;
      if (target === undefined) return;
      event.preventDefault();
      tabs[target].focus();
      tabs[target].click();
    });
  });

  function announce(message) {
    const toast = document.querySelector("#toast");
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3500);
  }

  document.querySelector("#copy-code").addEventListener("click", async () => {
    const code = document.querySelector(".code-panel:not([hidden]) code");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(code.textContent);
      announce("代码已复制。");
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      announce("已选中代码，请使用 Ctrl+C 或 ⌘C 复制。");
    }
  });
  document.querySelector("#year").textContent = String(new Date().getFullYear());

  // Architecture loops only while visible; deliberate pauses survive leaving the viewport.
  if ("IntersectionObserver" in window) {
    const playbackObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === demo) {
          demoInView = entry.isIntersecting;
          if (demoInView) startDemo();
          else stopDemo();
        } else if (!entry.isIntersecting) {
          stopLifecycle();
        }
      });
    });
    playbackObserver.observe(demo);
    playbackObserver.observe(document.querySelector(".lifecycle-card"));
  } else {
    demoInView = true;
    startDemo();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stopDemo(); stopLifecycle(); }
    else startDemo();
  });
})();
