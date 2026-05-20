/**
 * 앱 엔트리 포인트입니다.
 *
 * Web Components와 Shadow DOM을 지원하는 현대 브라우저에서만 실제 앱을 로드합니다.
 * 지원하지 않는 환경에서는 `index.html`의 fallback 안내를 유지합니다.
 */
if ("customElements" in window && "attachShadow" in Element.prototype) {
	import("./components/wordbook-app.js").catch(() => {
		const fallback = document.querySelector(".fallback-shell p");
		if (fallback) {
			fallback.textContent = "앱 모듈을 불러오지 못했습니다. 네트워크 연결과 브라우저 지원 여부를 확인해 주세요.";
		}
	});
} else {
	const fallback = document.querySelector(".fallback-shell p");
	if (fallback) {
		fallback.textContent = "이 브라우저는 Web Components 또는 Shadow DOM을 지원하지 않습니다.";
	}
}
