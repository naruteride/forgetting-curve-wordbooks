import {
	getUserWordStatsForWordbooks,
	getWordsFromWordbooks,
	updateStudyResult,
} from "../services/firebase-service.js";
import { applyStudyAnswer, buildStudyQueue } from "../domain/study-scheduler.js";
import { sharedStyles } from "../styles/shared-styles.js";
import { escapeHtml, formatDate, renderLines, setButtonLoading } from "./component-utils.js";

const fieldLabels = {
	term: "단어",
	pronunciation: "발음",
	meaning: "뜻",
	example: "예문",
};

/**
 * 한 단어가 한 화면을 차지하는 학습 화면입니다.
 *
 * 카드 클릭, Enter/Space, 좌우 스와이프로 앞뒷면을 전환하고,
 * `외움`/`잊음` 응답에 따라 Firestore 통계를 갱신합니다.
 */
class StudyView extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this._user = null;
		this._session = null;
		this.queue = [];
		this.initialTotal = 0;
		this.completed = 0;
		this.loading = true;
		this.error = "";
		this.cardRotation = 0;
		this.flipped = false;
		this.answering = false;
		this.touchStartX = 0;
	}

	set user(value) {
		this._user = value;
		if (this.isConnected && this.session) {
			this.load();
		}
	}

	get user() {
		return this._user;
	}

	set session(value) {
		this._session = value;
		if (this.isConnected && this.user) {
			this.load();
		}
	}

	get session() {
		return this._session;
	}

	connectedCallback() {
		this.render();
		if (this.user && this.session) {
			this.load();
		}
	}

	async load() {
		this.loading = true;
		this.error = "";
		this.completed = 0;
		this.cardRotation = 0;
		this.flipped = false;
		this.render();

		try {
			const [words, statsByWordbook] = await Promise.all([
				getWordsFromWordbooks(this.session.wordbookIds),
				getUserWordStatsForWordbooks(this.session.wordbookIds, this.user.uid),
			]);
			const merged = words.map((word) => ({
				...word,
				...(statsByWordbook[word.wordbookId]?.[word.id] || { studyCount: 0, lastStudiedAt: null }),
			}));
			this.queue = buildStudyQueue(merged, this.session);
			this.initialTotal = this.queue.length;
		} catch {
			this.error = "학습할 단어를 불러오지 못했습니다.";
		} finally {
			this.loading = false;
			this.render();
		}
	}

	render() {
		const currentWord = this.queue[0];
		this.shadowRoot.innerHTML = `
			<style>
				${sharedStyles}
				:host {
					display: block;
					min-height: calc(100vh - 120px);
				}

				.study {
					display: grid;
					gap: 1rem;
					grid-template-rows: auto minmax(360px, 1fr) auto;
					min-height: calc(100vh - 170px);
				}

				.topbar {
					align-items: center;
					display: grid;
					gap: 1rem;
					grid-template-columns: minmax(0, 1fr);
				}

				.progress-wrap {
					display: grid;
					gap: 0.45rem;
				}

				progress {
					accent-color: #1f6f5b;
					height: 12px;
					width: 100%;
				}

				.stage {
					align-items: center;
					display: grid;
					perspective: 1600px;
				}

				.card {
					background: transparent;
					border: 0;
					cursor: pointer;
					display: grid;
					min-height: min(62vh, 620px);
					padding: 0;
					position: relative;
					transform: rotateY(var(--card-rotation, 0deg));
					transform-style: preserve-3d;
					transition:
						opacity 220ms ease,
						transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
					width: 100%;
				}

				.card.remembered {
					opacity: 0;
					transform: translateX(42px) scale(0.98) rotateY(0deg);
				}

				.card.forgotten {
					opacity: 0;
					transform: translateX(-42px) scale(0.98) rotateY(0deg);
				}

				.face {
					align-content: center;
					backface-visibility: hidden;
					background: #fffefb;
					border: 1px solid #e4ddcf;
					border-radius: 8px;
					display: grid;
					gap: 1.25rem;
					inset: 0;
					justify-items: center;
					min-height: min(62vh, 620px);
					padding: clamp(1.5rem, 6vw, 4rem);
					position: absolute;
					text-align: center;
				}

				.back {
					transform: rotateY(180deg);
					text-align: left;
				}

				.face-content {
					display: grid;
					gap: 1rem;
					max-width: 760px;
					width: 100%;
				}

				.term {
					font-size: clamp(2.7rem, 13vw, 8rem);
					font-weight: 900;
					letter-spacing: 0;
					line-height: 0.95;
					overflow-wrap: anywhere;
				}

				.field {
					display: grid;
					gap: 0.3rem;
				}

				.field-label {
					color: #656b64;
					font-size: 0.92rem;
					font-weight: 800;
				}

				.field-value {
					font-size: clamp(1.1rem, 3vw, 1.6rem);
					line-height: 1.55;
					overflow-wrap: anywhere;
				}

				.back .field-value {
					font-size: 1rem;
				}

				.back ul {
					margin: 0;
					padding-left: 1.2rem;
				}

				.answer-bar {
					display: grid;
					gap: 0.75rem;
					grid-template-columns: 1fr 1fr;
				}

				.answer-bar button {
					font-size: clamp(1.05rem, 3vw, 1.3rem);
					font-weight: 850;
					min-height: 64px;
				}

				@media (max-width: 620px) {
					.topbar {
						grid-template-columns: 1fr;
					}
				}
			</style>

			<section class="study" aria-label="학습 화면">
				<div class="topbar">
					${this.renderProgress()}
				</div>

				${this.renderBody(currentWord)}
			</section>
		`;

		this.bindEvents();
	}

	renderProgress() {
		if (!this.session?.useForgettingCurve || this.initialTotal === 0) {
			return `<p class="muted">${this.queue.length}개 남음</p>`;
		}
		return `
			<div class="progress-wrap" aria-label="망각곡선 학습 진행률">
				<progress max="${this.initialTotal}" value="${this.completed}"></progress>
				<span class="muted">${this.completed} / ${this.initialTotal}</span>
			</div>
		`;
	}

	renderBody(currentWord) {
		if (this.loading) {
			return `<div class="empty">학습할 단어를 불러오는 중입니다.</div>`;
		}
		if (this.error) {
			return `<div class="empty error" role="alert">${this.error}</div>`;
		}
		if (!currentWord) {
			return `
				<div class="empty">
					<h2 style="margin-top: 0;">학습 완료</h2>
					<p>현재 조건에서 볼 단어가 없습니다.</p>
				</div>
			`;
		}

		return `
			<div class="stage">
				<div
					class="card"
					id="study-card"
					role="button"
					tabindex="0"
					aria-pressed="${this.flipped ? "true" : "false"}"
					style="--card-rotation: ${this.cardRotation}deg;"
					aria-label="카드 앞뒤 전환"
				>
					<div class="face front">
						<div class="face-content">
							${this.renderFront(currentWord)}
						</div>
					</div>
					<div class="face back">
						<div class="face-content">
							${this.renderBack(currentWord)}
						</div>
					</div>
				</div>
			</div>
			<div class="answer-bar">
				<button class="danger" id="forget-button" type="button">잊음</button>
				<button class="primary" id="remember-button" type="button">외움</button>
			</div>
		`;
	}

	renderFront(word) {
		const fields = this.session.visibleFields || ["term"];
		return fields.map((field) => this.renderField(word, field, field === "term")).join("");
	}

	renderBack(word) {
		return `
			${this.renderField(word, "term", true)}
			${this.renderField(word, "pronunciation")}
			${this.renderField(word, "meaning")}
			${this.renderField(word, "example")}
			<div class="field">
				<span class="field-label">학습 기록</span>
				<span class="field-value">외운 횟수 ${word.studyCount || 0} · 마지막 학습 ${formatDate(word.lastStudiedAt)}</span>
			</div>
		`;
	}

	renderField(word, field, isTerm = false) {
		if (field === "term") {
			return `
				<div class="field">
					<span class="field-label">${fieldLabels.term}</span>
					<span class="${isTerm ? "term" : "field-value"}">${escapeHtml(word.term)}</span>
				</div>
			`;
		}
		const values = {
			pronunciation: word.pronunciations,
			meaning: word.meanings,
			example: word.examples,
		}[field];
		return `
			<div class="field">
				<span class="field-label">${fieldLabels[field]}</span>
				<div class="field-value">${renderLines(values)}</div>
			</div>
		`;
	}

	bindEvents() {
		const card = this.shadowRoot.getElementById("study-card");
		if (card) {
			card.addEventListener("click", () => this.toggleCard());
			card.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					this.toggleCard();
				}
			});
			card.addEventListener("touchstart", (event) => {
				this.touchStartX = event.changedTouches[0].clientX;
			});
			card.addEventListener("touchend", (event) => {
				const diff = event.changedTouches[0].clientX - this.touchStartX;
				if (Math.abs(diff) > 42) {
					this.toggleCard(diff > 0 ? 1 : -1);
				}
			});
		}
		this.shadowRoot.getElementById("remember-button")?.addEventListener("click", (event) => {
			this.handleAnswer(event, true);
		});
		this.shadowRoot.getElementById("forget-button")?.addEventListener("click", (event) => {
			this.handleAnswer(event, false);
		});
	}

	toggleCard(direction = 1) {
		if (this.answering) {
			return;
		}
		const card = this.shadowRoot.getElementById("study-card");
		if (!card) {
			return;
		}
		this.cardRotation += direction * 180;
		this.flipped = Math.abs(this.cardRotation / 180) % 2 === 1;
		card.style.setProperty("--card-rotation", `${this.cardRotation}deg`);
		card.setAttribute("aria-pressed", String(this.flipped));
	}

	async handleAnswer(event, remembered) {
		const button = event.currentTarget;
		const currentWord = this.queue[0];
		const card = this.shadowRoot.getElementById("study-card");
		if (!currentWord || !card || this.answering) {
			return;
		}

		try {
			this.answering = true;
			setButtonLoading(button, true);
			this.setAnswerButtonsDisabled(true);
			const transitionDone = this.waitForCardTransition(card);
			const saveResult = updateStudyResult({
				wordbookId: currentWord.wordbookId,
				wordId: currentWord.id,
				uid: this.user.uid,
				remembered,
			}).then(
				() => null,
				(error) => error
			);
			card.classList.add(remembered ? "remembered" : "forgotten");
			await transitionDone;
			const result = applyStudyAnswer(this.queue, {
				currentIndex: 0,
				remembered,
				sortMode: this.session.sortMode,
			});
			this.queue = result.queue.map((word) => {
				if (word.id !== currentWord.id || word.wordbookId !== currentWord.wordbookId) {
					return word;
				}
				return {
					...word,
					studyCount: remembered ? Number(word.studyCount || 0) + 1 : 0,
					lastStudiedAt: new Date(),
				};
			});
			if (remembered) {
				this.completed += 1;
			}
			this.cardRotation = 0;
			this.flipped = false;
			this.answering = false;
			this.render();
			const saveError = await saveResult;
			if (saveError) {
				throw saveError;
			}
		} catch {
			this.answering = false;
			this.error = "학습 기록을 저장하지 못했습니다.";
			this.render();
		} finally {
			setButtonLoading(button, false);
		}
	}

	setAnswerButtonsDisabled(disabled) {
		this.shadowRoot.getElementById("remember-button")?.toggleAttribute("disabled", disabled);
		this.shadowRoot.getElementById("forget-button")?.toggleAttribute("disabled", disabled);
	}

	waitForCardTransition(card) {
		return new Promise((resolve) => {
			let done = false;
			const finish = () => {
				if (done) {
					return;
				}
				done = true;
				window.clearTimeout(timer);
				card.removeEventListener("transitionend", handleTransitionEnd);
				resolve();
			};
			const handleTransitionEnd = (event) => {
				if (event.target === card && event.propertyName === "transform") {
					finish();
				}
			};
			const timer = window.setTimeout(finish, 520);
			card.addEventListener("transitionend", handleTransitionEnd);
		});
	}
}

customElements.define("study-view", StudyView);
