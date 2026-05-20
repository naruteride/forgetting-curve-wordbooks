import { signOutUser } from "../services/firebase-service.js";
import { sharedStyles } from "../styles/shared-styles.js";
import { emit } from "./component-utils.js";

/**
 * 로그인 이후 공통 레이아웃을 제공하는 앱 셸입니다.
 *
 * 헤더, 홈 이동, 로그아웃 버튼을 담당하고 실제 화면은 기본 슬롯에 렌더링합니다.
 */
class AppShell extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this._user = null;
		this._hideHeader = false;
	}

	set user(value) {
		this._user = value;
		if (this.isConnected) {
			this.render();
		}
	}

	get user() {
		return this._user;
	}

	set hideHeader(value) {
		this._hideHeader = Boolean(value);
		if (this.isConnected) {
			this.render();
		}
	}

	get hideHeader() {
		return this._hideHeader;
	}

	connectedCallback() {
		this.render();
	}

	render() {
		const email = this.user?.email || "로그인됨";
		const header = this.hideHeader
			? ""
			: `
				<header>
					<div class="header-inner">
						<button class="brand" id="home-button" type="button">망각곡선 단어장</button>
						<div class="cluster">
							<span class="user muted">${email}</span>
							<button class="ghost" id="logout-button" type="button">로그아웃</button>
						</div>
					</div>
				</header>
			`;
		this.shadowRoot.innerHTML = `
			<style>
				${sharedStyles}
				:host {
					display: block;
					min-height: 100vh;
				}

				header {
					backdrop-filter: blur(14px);
					background: rgba(247, 245, 239, 0.86);
					border-bottom: 1px solid #e4ddcf;
				}

				.header-inner,
				main {
					margin: 0 auto;
					max-width: 1120px;
					width: min(100%, 1120px);
				}

				.header-inner {
					align-items: center;
					display: flex;
					gap: 1rem;
					justify-content: space-between;
					padding: 1rem;
				}

				.brand {
					background: transparent;
					color: #17201b;
					font-size: 1rem;
					font-weight: 800;
					min-height: 44px;
					padding-inline: 0;
				}

				main {
					padding: clamp(1.25rem, 4vw, 3.5rem) 1rem 4rem;
				}

				.user {
					font-size: 0.9rem;
					max-width: 32vw;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				@media (max-width: 640px) {
					.user {
						display: none;
					}
				}
			</style>
			${header}
			<main>
				<slot></slot>
			</main>
		`;
		this.shadowRoot.getElementById("home-button")?.addEventListener("click", () => {
			emit(this, "navigate-home");
		});
		this.shadowRoot.getElementById("logout-button")?.addEventListener("click", async () => {
			await signOutUser();
		});
	}
}

customElements.define("app-shell", AppShell);
