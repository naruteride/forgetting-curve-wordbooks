import { sharedStyles } from "../styles/shared-styles.js";
import {
	createAccountWithEmail,
	signInWithEmail,
	signInWithGoogle,
} from "../services/firebase-service.js";
import { setButtonLoading } from "./component-utils.js";

/**
 * 로그인과 회원가입을 담당하는 인증 화면입니다.
 *
 * Firebase Auth의 이메일/비밀번호 인증과 Google 팝업 인증을 제공합니다.
 * 인증 상태 변화는 상위 `wordbook-app`이 구독하므로 이 컴포넌트는 인증 요청만 수행합니다.
 */
class AuthView extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this.mode = "login";
		this.error = "";
	}

	connectedCallback() {
		this.render();
	}

	render() {
		const isLogin = this.mode === "login";
		this.shadowRoot.innerHTML = `
			<style>
				${sharedStyles}
				:host {
					align-items: center;
					display: grid;
					min-height: 100vh;
					padding: 1rem;
				}

				.auth-card {
					margin: auto;
					max-width: 420px;
					width: 100%;
				}

				h1 {
					font-size: clamp(2rem, 8vw, 3.7rem);
					letter-spacing: 0;
					line-height: 1;
					margin: 0 0 0.85rem;
				}

				p {
					line-height: 1.6;
					margin: 0;
				}

				form {
					display: grid;
					gap: 0.9rem;
					margin-top: 1.4rem;
				}

				.divider {
					align-items: center;
					color: #767b73;
					display: grid;
					font-size: 0.9rem;
					grid-template-columns: 1fr auto 1fr;
					gap: 0.75rem;
					margin: 1.2rem 0;
				}

				.divider::before,
				.divider::after {
					background: #ded7c9;
					content: "";
					height: 1px;
				}
			</style>
			<main class="auth-card panel" aria-labelledby="auth-title">
				<h1 id="auth-title">망각곡선 단어장</h1>
				<p class="muted">오늘 다시 봐야 할 단어만 남기고, 오래 기억할 단어는 천천히 다시 보여줍니다.</p>

				<form id="email-form">
					<label>
						이메일
						<input id="email" type="email" autocomplete="email" required />
					</label>
					<label>
						비밀번호
						<input id="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" minlength="6" required />
					</label>
					${this.error ? `<p class="error" role="alert">${this.error}</p>` : ""}
					<button class="primary" id="email-submit" type="submit">${isLogin ? "이메일로 로그인" : "이메일로 가입"}</button>
				</form>

				<div class="divider">또는</div>
				<button class="secondary" id="google-button" type="button">Google로 계속하기</button>
				<p class="muted" style="margin-top: 1rem;">
					<button class="ghost" id="mode-button" type="button">${isLogin ? "계정 만들기" : "로그인으로 돌아가기"}</button>
				</p>
			</main>
		`;

		this.shadowRoot.getElementById("email-form").addEventListener("submit", (event) => {
			this.handleEmailSubmit(event);
		});
		this.shadowRoot.getElementById("google-button").addEventListener("click", (event) => {
			this.handleGoogle(event);
		});
		this.shadowRoot.getElementById("mode-button").addEventListener("click", () => {
			this.mode = isLogin ? "signup" : "login";
			this.error = "";
			this.render();
		});
	}

	async handleEmailSubmit(event) {
		event.preventDefault();
		const submitButton = this.shadowRoot.getElementById("email-submit");
		const email = this.shadowRoot.getElementById("email").value.trim();
		const password = this.shadowRoot.getElementById("password").value;

		try {
			this.error = "";
			setButtonLoading(submitButton, true);
			if (this.mode === "login") {
				await signInWithEmail(email, password);
			} else {
				await createAccountWithEmail(email, password);
			}
		} catch (error) {
			this.error = getFriendlyAuthError(error);
			this.render();
		} finally {
			setButtonLoading(submitButton, false);
		}
	}

	async handleGoogle(event) {
		const button = event.currentTarget;
		try {
			this.error = "";
			setButtonLoading(button, true);
			await signInWithGoogle();
		} catch (error) {
			this.error = getFriendlyAuthError(error);
			this.render();
		} finally {
			setButtonLoading(button, false);
		}
	}
}

/**
 * Firebase Auth 오류 코드를 사용자가 이해하기 쉬운 한국어 문장으로 변환합니다.
 *
 * @param {unknown} error Firebase 오류 객체입니다.
 * @returns {string} 화면에 표시할 오류 메시지입니다.
 */
function getFriendlyAuthError(error) {
	const code = error?.code || "auth/unknown";
	const messages = {
		"auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
		"auth/user-disabled": "비활성화된 계정입니다.",
		"auth/user-not-found": "가입된 이메일을 찾을 수 없습니다.",
		"auth/wrong-password": "비밀번호가 올바르지 않습니다.",
		"auth/invalid-credential": "이메일 또는 비밀번호를 확인해 주세요.",
		"auth/email-already-in-use": "이미 사용 중인 이메일입니다.",
		"auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
		"auth/popup-closed-by-user": "Google 로그인 창이 닫혔습니다.",
	};
	return messages[code] || "인증에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

customElements.define("auth-view", AuthView);
