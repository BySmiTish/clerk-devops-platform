/**
 * Backend version badge: fetches /api/version (prod) or /staging/api/version (staging)
 * and shows "Backend: <service> <commit7> <build_time>" in #backend-build-badge.
 */
(function () {
  var el = document.getElementById("backend-build-badge");
  if (!el) return;

  var pathname = window.location.pathname || "";
  var isStaging = pathname.indexOf("/staging/") === 0 || pathname === "/staging" || pathname === "/staging";
  var url = isStaging ? "/staging/api/version" : "/api/version";

  fetch(url, { cache: "no-store" })
    .then(function (res) {
      if (res.status === 401) {
        el.textContent = "Backend: auth required";
        return null;
      }
      if (!res.ok) {
        el.textContent = "Backend: unavailable";
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      var service = data.service || "unknown";
      var apiVer = data.api_version || "";
      var commit = (data.commit || "unknown").slice(0, 7);
      var buildTime = data.build_time || "unknown";
      el.textContent = "Backend: " + service + (apiVer ? " " + apiVer : "") + " " + commit + " " + buildTime;
    })
    .catch(function () {
      el.textContent = "Backend: unavailable";
    });
})();
