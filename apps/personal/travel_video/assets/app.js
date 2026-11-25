window.AppUIReady.then(() => {
  const base = "/v1/apps/personal/travel_video/";
  const el = (t, txt) => { const n = document.createElement(t); if (txt !== undefined) n.textContent = String(txt); return n; };
  async function api(op, args = {}) {
    const r = await AppUIApi.requestResponse(base + op, args, { method: "POST", decode: (x) => x.json() });
    if (!r.data?.ok) throw new Error(r.data?.error || "Request failed");
    return r.data;
  }
  let host;
  async function render() {
    const res = await api("projects_list");
    host.textContent = "";
    host.append(el("h2", "Travel Video Projects (" + res.total + ")"));
    for (const p of res.projects || []) {
      host.append(el("p", p.title + " [" + p.phase + "] — " + p.sceneCount + " scene(s), " + p.totalSeconds + "s (" + p.unverifiedSceneCount + " unverified)"));
    }
    if (!res.projects?.length) host.append(el("p", "No travel video projects saved yet."));
  }
  AppUI.createApp({ id: "personal-travel-video", title: "Travel Video Studio", content: { render: (h) => { host = h; host.style.padding = "14px"; } }, statusbar: {} });
  render().catch((e) => { if (host) host.textContent = e.message; });
});
