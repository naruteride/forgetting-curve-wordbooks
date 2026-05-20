import { observeAuthState } from "../services/firebase-service.js";
import { sharedStyles } from "../styles/shared-styles.js";
import "./app-shell.js";
import "./auth-view.js";
import "./home-view.js";
import "./study-setup-dialog.js";
import "./study-view.js";
import "./wordbook-view.js";

/**
 * 앱 최상위 컴포넌트입니다.
 *
 * 인증 상태와 해시 기반 라우팅을 관리하고, 홈/단어장/학습 화면을 교체합니다.
 */
class WordbookApp extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this.user = null;
		this.authLoading = true;
		this.authError = "";
		this.unsubscribe = null;
		this.studySession = null;
	}

	connectedCallback() {
		this.render();
		this.unsubscribe = observeAuthState((user, error) => {
			if (error) {
				this.authError = "Firebase SDK를 불러오지 못했습니다. 네트워크 연결과 배포 환경을 확인해 주세요.";
				this.authLoading = false;
				this.render();
				return;
			}
			this.authError = "";
			this.user = user;
			this.authLoading = false;
			this.render();
		});
		window.addEventListener("hashchange", this.handleHashChange);
		this.shadowRoot.addEventListener("open-wordbook", (event) => {
			this.openWordbook(event.detail.wordbookId);
		});
		this.shadowRoot.addEventListener("start-study", (event) => {
			this.studySession = event.detail;
			window.location.hash = "#/study";
			this.render();
		});
	}

	disconnectedCallback() {
		this.unsubscribe?.();
		window.removeEventListener("hashchange", this.handleHashChange);
	}

	handleHashChange = () => {
		this.render();
	};

	openWordbook(wordbookId) {
		window.location.hash = `#/wordbooks/${encodeURIComponent(wordbookId)}`;
		this.render();
	}

	getRoute() {
		const hash = window.location.hash || "#/";
		const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
		if (parts[0] === "wordbooks" && parts[1]) {
			return { name: "wordbook", wordbookId: decodeURIComponent(parts[1]) };
		}
		if (parts[0] === "study") {
			return { name: "study" };
		}
		return { name: "home" };
	}

	render() {
		this.shadowRoot.innerHTML = `
			<style>
				${sharedStyles}
				.loading {
					align-items: center;
					display: grid;
					min-height: 100vh;
					place-items: center;
				}
			</style>
			<div id="root"></div>
		`;

		const root = this.shadowRoot.getElementById("root");
		if (this.authLoading) {
			root.innerHTML = `<div class="loading muted">인증 상태를 확인하는 중입니다.</div>`;
			return;
		}

		if (this.authError) {
			root.innerHTML = `
				<div class="loading">
					<div class="panel" role="alert" style="max-width: 520px;">
						<h1 style="margin-top: 0;">연결 오류</h1>
						<p class="muted">${this.authError}</p>
						<button class="primary" id="reload-button" type="button">다시 시도</button>
					</div>
				</div>
			`;
			this.shadowRoot.getElementById("reload-button").addEventListener("click", () => window.location.reload());
			return;
		}

		if (!this.user) {
			root.append(document.createElement("auth-view"));
			return;
		}

		const route = this.getRoute();
		const shell = document.createElement("app-shell");
		shell.user = this.user;
		shell.hideHeader = route.name === "study" && Boolean(this.studySession);
		shell.append(this.createRouteView(route));
		root.append(shell);
	}

	createRouteView(route = this.getRoute()) {
		if (route.name === "wordbook") {
			const view = document.createElement("wordbook-view");
			view.user = this.user;
			view.wordbookId = route.wordbookId;
			return view;
		}
		if (route.name === "study") {
			if (!this.studySession) {
				const view = document.createElement("home-view");
				view.user = this.user;
				return view;
			}
			const view = document.createElement("study-view");
			view.user = this.user;
			view.session = this.studySession;
			return view;
		}
		const view = document.createElement("home-view");
		view.user = this.user;
		return view;
	}
}

customElements.define("wordbook-app", WordbookApp);
