import {
	createWord,
	deleteWord,
	getUserWordStats,
	getWordbook,
	getWordsFromWordbook,
	updateWord,
} from "../services/firebase-service.js";
import { filterWords, parseLines, sortWords } from "../domain/study-scheduler.js";
import { sharedStyles } from "../styles/shared-styles.js";
import { emit, escapeHtml, formatDate, renderLines, setButtonLoading } from "./component-utils.js";

const searchScopes = [
	["all", "전체"],
	["term", "외울 단어"],
	["pronunciation", "발음"],
	["meaning", "한국어 뜻"],
	["example", "예문"],
];

/**
 * 특정 단어장 내부에서 단어를 추가, 수정, 삭제, 검색, 필터링하는 화면입니다.
 */
class WordbookView extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this._user = null;
		this._wordbookId = "";
		this.wordbook = null;
		this.words = [];
		this.loading = true;
		this.error = "";
		this.searchQuery = "";
		this.searchScope = "all";
		this.sortMode = "created-desc";
		this.useForgettingCurve = false;
		this.editingWord = null;
		this.deletingWord = null;
	}

	set user(value) {
		this._user = value;
		if (this.isConnected && this.wordbookId) {
			this.load();
		}
	}

	get user() {
		return this._user;
	}

	set wordbookId(value) {
		this._wordbookId = value;
		if (this.isConnected && this.user) {
			this.load();
		}
	}

	get wordbookId() {
		return this._wordbookId;
	}

	connectedCallback() {
		this.render();
		if (this.user && this.wordbookId) {
			this.load();
		}
	}

	async load() {
		this.loading = true;
		this.error = "";
		this.render();
		try {
			const [wordbook, words, stats] = await Promise.all([
				getWordbook(this.wordbookId),
				getWordsFromWordbook(this.wordbookId),
				getUserWordStats(this.wordbookId, this.user.uid),
			]);
			this.wordbook = wordbook;
			this.words = words.map((word) => ({
				...word,
				...(stats[word.id] || { studyCount: 0, lastStudiedAt: null }),
			}));
		} catch {
			this.error = "단어장을 불러오지 못했습니다.";
		} finally {
			this.loading = false;
			this.render();
		}
	}

	render() {
		this.shadowRoot.innerHTML = `
			<style>
				${sharedStyles}
				.header {
					display: grid;
					gap: 1rem;
					grid-template-columns: minmax(0, 1fr) auto;
					margin-bottom: 1.5rem;
				}

				h1 {
					font-size: clamp(2rem, 8vw, 4.5rem);
					letter-spacing: 0;
					line-height: 1;
					margin: 0;
					overflow-wrap: anywhere;
				}

				.controls {
					display: grid;
					gap: 0.75rem;
					grid-template-columns: minmax(180px, 1fr) minmax(140px, 180px) minmax(160px, 220px) auto;
					margin-bottom: 1rem;
				}

				.curve-toggle {
					align-items: center;
					background: #fffefb;
					border: 1px solid #d8d2c4;
					border-radius: 8px;
					display: flex;
					gap: 0.65rem;
					min-height: 44px;
					padding: 0.65rem 0.8rem;
				}

				.curve-toggle input {
					min-height: auto;
					width: auto;
				}

				.word-list {
					display: grid;
					gap: 0.75rem;
				}

				.word {
					background: #fffefb;
					border: 1px solid #e4ddcf;
					border-radius: 8px;
					display: grid;
					gap: 0.9rem;
					padding: 1rem;
				}

				.word-main {
					display: grid;
					gap: 0.4rem;
				}

				.term {
					font-size: clamp(1.4rem, 5vw, 2.4rem);
					font-weight: 850;
					letter-spacing: 0;
					overflow-wrap: anywhere;
				}

				dl {
					display: grid;
					gap: 0.65rem;
					grid-template-columns: 90px minmax(0, 1fr);
					margin: 0;
				}

				dt {
					color: #656b64;
					font-weight: 750;
				}

				dd {
					margin: 0;
					min-width: 0;
				}

				ul {
					margin: 0;
					padding-left: 1.1rem;
				}

				@media (max-width: 820px) {
					.header,
					.controls {
						grid-template-columns: 1fr;
					}

					dl {
						grid-template-columns: 1fr;
					}
				}
			</style>

			<section class="header" aria-labelledby="wordbook-title">
				<div>
					<button class="ghost" id="back-button" type="button">Home</button>
					<h1 id="wordbook-title">${escapeHtml(this.wordbook?.name || "단어장")}</h1>
					<p class="muted">${this.words.length}개 단어</p>
				</div>
				<div class="cluster" style="align-self: end; justify-content: flex-end;">
					<button class="secondary" id="start-study-button" type="button" ${this.words.length === 0 ? "disabled" : ""}>이 단어장 학습</button>
					<button class="primary" id="add-word-button" type="button">단어 추가</button>
				</div>
			</section>

			${this.error ? `<p class="error" role="alert">${this.error}</p>` : ""}

			<section class="panel" aria-label="단어 검색과 필터">
				<div class="controls">
					<label>
						검색어
						<input id="search-input" type="search" value="${escapeHtml(this.searchQuery)}" placeholder="검색" />
					</label>
					<label>
						검색 범위
						<select id="scope-select">
							${searchScopes.map(([value, label]) => `<option value="${value}" ${this.searchScope === value ? "selected" : ""}>${label}</option>`).join("")}
						</select>
					</label>
					<label>
						정렬
						<select id="sort-select">
							<option value="created-desc" ${this.sortMode === "created-desc" ? "selected" : ""}>추가일 최신순</option>
							<option value="created-asc" ${this.sortMode === "created-asc" ? "selected" : ""}>추가일 오래된순</option>
							<option value="term-asc" ${this.sortMode === "term-asc" ? "selected" : ""}>단어 오름차순</option>
							<option value="random" ${this.sortMode === "random" ? "selected" : ""}>랜덤</option>
						</select>
					</label>
					<label class="curve-toggle">
						<input id="curve-checkbox" type="checkbox" ${this.useForgettingCurve ? "checked" : ""} />
						<span>망각곡선</span>
					</label>
				</div>
			</section>

			<div id="word-list" class="word-list" aria-live="polite"></div>

			<dialog id="word-dialog" aria-labelledby="word-dialog-title">
				<form class="dialog-body" id="word-form">
					<h2 id="word-dialog-title" style="margin: 0;">${this.editingWord ? "단어 수정" : "단어 추가"}</h2>
					<label>
						외울 단어
						<input id="term-input" name="term" required value="${escapeHtml(this.editingWord?.term || "")}" />
					</label>
					<label>
						발음
						<textarea id="pronunciation-input" name="pronunciations" placeholder="줄바꿈으로 여러 개 입력">${escapeHtml((this.editingWord?.pronunciations || []).join("\n"))}</textarea>
					</label>
					<label>
						한국어 뜻
						<textarea id="meaning-input" name="meanings" placeholder="줄바꿈으로 여러 개 입력">${escapeHtml((this.editingWord?.meanings || []).join("\n"))}</textarea>
					</label>
					<label>
						예문
						<textarea id="example-input" name="examples" placeholder="줄바꿈으로 여러 개 입력">${escapeHtml((this.editingWord?.examples || []).join("\n"))}</textarea>
					</label>
					<div class="dialog-actions">
						<button class="secondary" type="button" id="word-cancel-button">취소</button>
						<button class="primary" type="submit" id="word-save-button">저장</button>
					</div>
				</form>
			</dialog>

			<dialog id="delete-word-dialog" aria-labelledby="delete-word-title">
				<form class="dialog-body" id="delete-word-form">
					<h2 id="delete-word-title" style="margin: 0;">단어 삭제</h2>
					<p class="muted">${this.deletingWord ? `"${escapeHtml(this.deletingWord.term)}"` : "선택한"} 단어를 삭제합니다.</p>
					<div class="dialog-actions">
						<button class="secondary" type="button" id="delete-word-cancel-button">취소</button>
						<button class="danger" type="submit" id="delete-word-confirm-button">삭제</button>
					</div>
				</form>
			</dialog>

			<study-setup-dialog></study-setup-dialog>
		`;

		this.bindEvents();
		this.updateWordList();
	}

	bindEvents() {
		this.shadowRoot.getElementById("back-button").addEventListener("click", () => emit(this, "navigate-home"));
		this.shadowRoot.getElementById("add-word-button").addEventListener("click", () => this.openWordDialog(null));
		this.shadowRoot.getElementById("start-study-button").addEventListener("click", () => {
			this.shadowRoot.querySelector("study-setup-dialog").openDialog([this.wordbook], {
				wordbookIds: [this.wordbookId],
			});
		});
		this.shadowRoot.getElementById("search-input").addEventListener("input", (event) => {
			this.searchQuery = event.currentTarget.value;
			this.updateWordList();
		});
		this.shadowRoot.getElementById("scope-select").addEventListener("change", (event) => {
			this.searchScope = event.currentTarget.value;
			this.updateWordList();
		});
		this.shadowRoot.getElementById("sort-select").addEventListener("change", (event) => {
			this.sortMode = event.currentTarget.value;
			this.updateWordList();
		});
		this.shadowRoot.getElementById("curve-checkbox").addEventListener("change", (event) => {
			this.useForgettingCurve = event.currentTarget.checked;
			this.updateWordList();
		});
		this.shadowRoot.getElementById("word-cancel-button").addEventListener("click", () => {
			this.shadowRoot.getElementById("word-dialog").close();
		});
		this.shadowRoot.getElementById("delete-word-cancel-button").addEventListener("click", () => {
			this.shadowRoot.getElementById("delete-word-dialog").close();
		});
		this.shadowRoot.getElementById("word-form").addEventListener("submit", (event) => this.handleWordSubmit(event));
		this.shadowRoot.getElementById("delete-word-form").addEventListener("submit", (event) => this.handleDeleteSubmit(event));
	}

	getVisibleWords() {
		return sortWords(
			filterWords(this.words, {
				query: this.searchQuery,
				scope: this.searchScope,
				useForgettingCurve: this.useForgettingCurve,
			}),
			this.sortMode
		);
	}

	updateWordList() {
		const list = this.shadowRoot.getElementById("word-list");
		if (!list) {
			return;
		}
		if (this.loading) {
			list.innerHTML = `<div class="empty">단어를 불러오는 중입니다.</div>`;
			return;
		}
		const visibleWords = this.getVisibleWords();
		if (visibleWords.length === 0) {
			list.innerHTML = `<div class="empty">조건에 맞는 단어가 없습니다.</div>`;
			return;
		}

		list.innerHTML = visibleWords.map((word) => this.renderWord(word)).join("");
		list.querySelectorAll("[data-word-action]").forEach((button) => {
			button.addEventListener("click", (event) => this.handleWordAction(event));
		});
	}

	renderWord(word) {
		return `
			<article class="word">
				<div class="spread">
					<div class="word-main">
						<div class="term">${escapeHtml(word.term)}</div>
						<div class="muted">외운 횟수 ${word.studyCount || 0} · 마지막 학습 ${formatDate(word.lastStudiedAt)} · 추가 ${formatDate(word.createdAt)}</div>
					</div>
					<div class="cluster">
						<button class="icon" type="button" data-word-action="edit" data-id="${word.id}" aria-label="단어 수정">E</button>
						<button class="icon" type="button" data-word-action="delete" data-id="${word.id}" aria-label="단어 삭제">D</button>
					</div>
				</div>
				<dl>
					<dt>발음</dt>
					<dd>${renderLines(word.pronunciations)}</dd>
					<dt>뜻</dt>
					<dd>${renderLines(word.meanings)}</dd>
					<dt>예문</dt>
					<dd>${renderLines(word.examples)}</dd>
				</dl>
			</article>
		`;
	}

	openWordDialog(word) {
		this.editingWord = word;
		this.render();
		this.shadowRoot.getElementById("word-dialog").showModal();
		this.shadowRoot.getElementById("term-input").focus();
	}

	handleWordAction(event) {
		const id = event.currentTarget.dataset.id;
		const action = event.currentTarget.dataset.wordAction;
		const word = this.words.find((item) => item.id === id);
		if (!word) {
			return;
		}
		if (action === "edit") {
			this.openWordDialog(word);
		} else if (action === "delete") {
			this.deletingWord = word;
			this.render();
			this.shadowRoot.getElementById("delete-word-dialog").showModal();
		}
	}

	async handleWordSubmit(event) {
		event.preventDefault();
		const button = this.shadowRoot.getElementById("word-save-button");
		const form = new FormData(event.currentTarget);
		const input = {
			term: String(form.get("term") || "").trim(),
			pronunciations: parseLines(form.get("pronunciations")),
			meanings: parseLines(form.get("meanings")),
			examples: parseLines(form.get("examples")),
		};

		try {
			setButtonLoading(button, true);
			if (this.editingWord) {
				await updateWord(this.wordbookId, this.editingWord.id, input);
			} else {
				await createWord(this.wordbookId, input, this.user);
			}
			this.editingWord = null;
			this.shadowRoot.getElementById("word-dialog").close();
			await this.load();
		} catch {
			this.error = "단어를 저장하지 못했습니다.";
			this.render();
		} finally {
			setButtonLoading(button, false);
		}
	}

	async handleDeleteSubmit(event) {
		event.preventDefault();
		if (!this.deletingWord) {
			return;
		}
		const button = this.shadowRoot.getElementById("delete-word-confirm-button");
		try {
			setButtonLoading(button, true);
			await deleteWord(this.wordbookId, this.deletingWord.id);
			this.deletingWord = null;
			this.shadowRoot.getElementById("delete-word-dialog").close();
			await this.load();
		} catch {
			this.error = "단어를 삭제하지 못했습니다.";
			this.render();
		} finally {
			setButtonLoading(button, false);
		}
	}
}

customElements.define("wordbook-view", WordbookView);
