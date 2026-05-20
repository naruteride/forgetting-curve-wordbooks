import {
	createWordbook,
	deleteWordbook,
	getUserWordbooks,
	updateWordbookName,
	updateWordbookOrder,
} from "../services/firebase-service.js";
import { sharedStyles } from "../styles/shared-styles.js";
import { emit, escapeHtml, formatDate, setButtonLoading } from "./component-utils.js";

/**
 * 단어장 목록과 단어장 CRUD, 드래그 앤 드롭 정렬을 제공하는 홈 화면입니다.
 */
class HomeView extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this._user = null;
		this.wordbooks = [];
		this.loading = true;
		this.error = "";
		this.editingWordbook = null;
		this.deletingWordbook = null;
		this.draggingId = "";
	}

	set user(value) {
		this._user = value;
		if (this.isConnected && value) {
			this.load();
		}
	}

	get user() {
		return this._user;
	}

	connectedCallback() {
		this.render();
		if (this.user) {
			this.load();
		}
	}

	async load() {
		this.loading = true;
		this.error = "";
		this.render();
		try {
			this.wordbooks = await getUserWordbooks(this.user.uid);
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
				.hero {
					display: grid;
					gap: 1rem;
					grid-template-columns: minmax(0, 1fr) auto;
					margin-bottom: clamp(1.5rem, 4vw, 3rem);
				}

				h1 {
					font-size: clamp(2.25rem, 9vw, 5.2rem);
					letter-spacing: 0;
					line-height: 0.98;
					margin: 0;
					max-width: 820px;
				}

				.actions {
					align-self: end;
					display: flex;
					flex-wrap: wrap;
					gap: 0.75rem;
					justify-content: flex-end;
				}

				.list {
					display: grid;
					gap: 0.75rem;
					list-style: none;
					margin: 0;
					padding: 0;
				}

				.wordbook {
					align-items: center;
					background: #fffefb;
					border: 1px solid #e4ddcf;
					border-radius: 8px;
					display: grid;
					gap: 1rem;
					grid-template-columns: auto minmax(0, 1fr) auto;
					padding: 0.9rem;
				}

				.wordbook[aria-grabbed="true"] {
					box-shadow: 0 18px 40px rgba(23, 32, 27, 0.12);
					opacity: 0.72;
				}

				.drag {
					color: #767b73;
					cursor: grab;
					font-weight: 800;
					text-align: center;
					width: 32px;
				}

				.name {
					font-size: 1.2rem;
					font-weight: 800;
					overflow-wrap: anywhere;
				}

				.meta {
					color: #656b64;
					font-size: 0.9rem;
					margin-top: 0.25rem;
				}

				@media (max-width: 760px) {
					.hero {
						grid-template-columns: 1fr;
					}

					.actions {
						justify-content: flex-start;
					}

					.wordbook {
						grid-template-columns: auto minmax(0, 1fr);
					}

					.row-actions {
						grid-column: 2;
						justify-content: flex-start;
					}
				}
			</style>

			<section class="hero" aria-labelledby="home-title">
				<div>
					<h1 id="home-title">오늘 다시 볼 단어만 남깁니다.</h1>
					<p class="muted" style="line-height: 1.7; max-width: 620px;">
						외운 횟수와 마지막 학습일을 기준으로 단어가 다시 나타나는 시점을 조절합니다.
					</p>
				</div>
				<div class="actions">
					<button class="secondary" id="start-study-button" type="button" ${this.wordbooks.length === 0 ? "disabled" : ""}>학습 시작</button>
					<button class="primary" id="create-wordbook-button" type="button">단어장 추가</button>
				</div>
			</section>

			${this.error ? `<p class="error" role="alert">${this.error}</p>` : ""}
			${this.loading ? `<div class="empty">단어장을 불러오는 중입니다.</div>` : this.renderWordbooks()}

			<dialog id="wordbook-dialog" aria-labelledby="wordbook-dialog-title">
				<form class="dialog-body" id="wordbook-form">
					<h2 id="wordbook-dialog-title" style="margin: 0;">${this.editingWordbook ? "단어장 이름 수정" : "단어장 추가"}</h2>
					<label>
						단어장 이름
						<input id="wordbook-name" name="name" required maxlength="80" value="${escapeHtml(this.editingWordbook?.name || "")}" />
					</label>
					<div class="dialog-actions">
						<button class="secondary" type="button" id="wordbook-cancel-button">취소</button>
						<button class="primary" type="submit" id="wordbook-save-button">저장</button>
					</div>
				</form>
			</dialog>

			<dialog id="delete-dialog" aria-labelledby="delete-dialog-title">
				<form class="dialog-body" id="delete-form">
					<h2 id="delete-dialog-title" style="margin: 0;">단어장 삭제</h2>
					<p class="muted">${this.deletingWordbook ? `"${escapeHtml(this.deletingWordbook.name)}"` : "선택한"} 단어장을 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
					<div class="dialog-actions">
						<button class="secondary" type="button" id="delete-cancel-button">취소</button>
						<button class="danger" type="submit" id="delete-confirm-button">삭제</button>
					</div>
				</form>
			</dialog>

			<study-setup-dialog></study-setup-dialog>
		`;

		this.bindEvents();
	}

	renderWordbooks() {
		if (this.wordbooks.length === 0) {
			return `<div class="empty">아직 단어장이 없습니다. 첫 단어장을 만들어 주세요.</div>`;
		}

		return `
			<ul class="list" aria-label="단어장 목록">
				${this.wordbooks
					.map(
						(wordbook) => `
							<li
								class="wordbook"
								draggable="true"
								data-id="${wordbook.id}"
								aria-grabbed="${this.draggingId === wordbook.id ? "true" : "false"}"
							>
								<span class="drag" aria-hidden="true">=</span>
								<div>
									<div class="name">${escapeHtml(wordbook.name)}</div>
									<div class="meta">생성일 ${formatDate(wordbook.createdAt)}</div>
								</div>
								<div class="cluster row-actions">
									<button class="ghost" data-action="open" data-id="${wordbook.id}" type="button">열기</button>
									<button class="icon" data-action="edit" data-id="${wordbook.id}" type="button" aria-label="단어장 이름 수정">E</button>
									<button class="icon" data-action="delete" data-id="${wordbook.id}" type="button" aria-label="단어장 삭제">D</button>
								</div>
							</li>
						`
					)
					.join("")}
			</ul>
		`;
	}

	bindEvents() {
		this.shadowRoot.getElementById("create-wordbook-button").addEventListener("click", () => {
			this.openWordbookDialog(null);
		});
		this.shadowRoot.getElementById("start-study-button").addEventListener("click", () => {
			this.shadowRoot.querySelector("study-setup-dialog").openDialog(this.wordbooks);
		});
		this.shadowRoot.getElementById("wordbook-cancel-button").addEventListener("click", () => {
			this.shadowRoot.getElementById("wordbook-dialog").close();
		});
		this.shadowRoot.getElementById("delete-cancel-button").addEventListener("click", () => {
			this.shadowRoot.getElementById("delete-dialog").close();
		});
		this.shadowRoot.getElementById("wordbook-form").addEventListener("submit", (event) => {
			this.handleWordbookSubmit(event);
		});
		this.shadowRoot.getElementById("delete-form").addEventListener("submit", (event) => {
			this.handleDeleteSubmit(event);
		});
		this.shadowRoot.querySelectorAll("[data-action]").forEach((button) => {
			button.addEventListener("click", (event) => {
				this.handleRowAction(event);
			});
		});
		this.shadowRoot.querySelectorAll(".wordbook").forEach((item) => {
			item.addEventListener("dragstart", (event) => this.handleDragStart(event));
			item.addEventListener("dragover", (event) => event.preventDefault());
			item.addEventListener("drop", (event) => this.handleDrop(event));
			item.addEventListener("dragend", () => {
				this.draggingId = "";
				this.render();
			});
		});
	}

	openWordbookDialog(wordbook) {
		this.editingWordbook = wordbook;
		this.render();
		this.shadowRoot.getElementById("wordbook-dialog").showModal();
		this.shadowRoot.getElementById("wordbook-name").focus();
	}

	handleRowAction(event) {
		const id = event.currentTarget.dataset.id;
		const action = event.currentTarget.dataset.action;
		const wordbook = this.wordbooks.find((item) => item.id === id);
		if (!wordbook) {
			return;
		}
		if (action === "open") {
			emit(this, "open-wordbook", { wordbookId: id });
		} else if (action === "edit") {
			this.openWordbookDialog(wordbook);
		} else if (action === "delete") {
			this.deletingWordbook = wordbook;
			this.render();
			this.shadowRoot.getElementById("delete-dialog").showModal();
		}
	}

	async handleWordbookSubmit(event) {
		event.preventDefault();
		const button = this.shadowRoot.getElementById("wordbook-save-button");
		const name = this.shadowRoot.getElementById("wordbook-name").value.trim();
		if (!name) {
			return;
		}

		try {
			setButtonLoading(button, true);
			if (this.editingWordbook) {
				await updateWordbookName(this.editingWordbook.id, name);
			} else {
				await createWordbook(name, this.user);
			}
			this.editingWordbook = null;
			this.shadowRoot.getElementById("wordbook-dialog").close();
			await this.load();
		} catch {
			this.error = "단어장을 저장하지 못했습니다.";
			this.render();
		} finally {
			setButtonLoading(button, false);
		}
	}

	async handleDeleteSubmit(event) {
		event.preventDefault();
		if (!this.deletingWordbook) {
			return;
		}

		const button = this.shadowRoot.getElementById("delete-confirm-button");
		try {
			setButtonLoading(button, true);
			await deleteWordbook(this.deletingWordbook.id, this.user.uid);
			this.deletingWordbook = null;
			this.shadowRoot.getElementById("delete-dialog").close();
			await this.load();
		} catch {
			this.error = "단어장을 삭제하지 못했습니다.";
			this.render();
		} finally {
			setButtonLoading(button, false);
		}
	}

	handleDragStart(event) {
		this.draggingId = event.currentTarget.dataset.id;
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", this.draggingId);
	}

	async handleDrop(event) {
		event.preventDefault();
		const targetId = event.currentTarget.dataset.id;
		const sourceId = event.dataTransfer.getData("text/plain") || this.draggingId;
		if (!sourceId || sourceId === targetId) {
			return;
		}

		const next = [...this.wordbooks];
		const fromIndex = next.findIndex((item) => item.id === sourceId);
		const toIndex = next.findIndex((item) => item.id === targetId);
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);
		this.wordbooks = next.map((item, index) => ({ ...item, order: index }));
		this.draggingId = "";
		this.render();

		try {
			await updateWordbookOrder(this.wordbooks);
		} catch {
			this.error = "단어장 순서를 저장하지 못했습니다.";
			this.render();
		}
	}
}

customElements.define("home-view", HomeView);
