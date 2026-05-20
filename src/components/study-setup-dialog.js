import { hasVisibleStudyField } from "../domain/study-scheduler.js";
import { sharedStyles } from "../styles/shared-styles.js";
import { emit, escapeHtml } from "./component-utils.js";

const fieldLabels = {
	term: "외울 단어",
	pronunciation: "발음",
	meaning: "한국어 뜻",
	example: "예문",
};

/**
 * 학습 시작 직전 단어장, 정렬, 망각곡선, 카드 앞면 노출 항목을 선택하는 대화상자입니다.
 */
class StudySetupDialog extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
		this.wordbooks = [];
		this.defaults = {};
		this.error = "";
	}

	connectedCallback() {
		this.render();
	}

	/**
	 * 학습 설정 대화상자를 엽니다.
	 *
	 * @param {object[]} wordbooks 선택 가능한 단어장 배열입니다.
	 * @param {object} [defaults] 기본 설정입니다.
	 * @returns {void}
	 */
	openDialog(wordbooks, defaults = {}) {
		this.wordbooks = wordbooks;
		this.defaults = defaults;
		this.error = "";
		this.render();
		this.shadowRoot.querySelector("dialog").showModal();
	}

	render() {
		const selectedIds = this.defaults.wordbookIds || this.wordbooks.map((wordbook) => wordbook.id);
		const visibleFields = this.defaults.visibleFields || ["term"];
		this.shadowRoot.innerHTML = `
			<style>
				${sharedStyles}
				.check-list {
					display: grid;
					gap: 0.45rem;
					max-height: 220px;
					overflow: auto;
					padding-right: 0.25rem;
				}

				.check-row {
					align-items: center;
					background: #f8f5ee;
					border: 1px solid #e4ddcf;
					border-radius: 8px;
					display: flex;
					gap: 0.75rem;
					padding: 0.75rem;
				}

				.check-row input {
					min-height: auto;
					width: auto;
				}
			</style>
			<dialog aria-labelledby="study-setup-title">
				<form method="dialog" class="dialog-body" id="study-form">
					<div class="spread">
						<h2 id="study-setup-title" style="margin: 0;">학습 시작</h2>
						<button class="icon" value="cancel" type="button" id="close-button" aria-label="닫기">x</button>
					</div>

					<label>
						학습할 단어장
						<div class="check-list">
							${this.wordbooks
								.map(
									(wordbook) => `
										<label class="check-row">
											<input type="checkbox" name="wordbook" value="${wordbook.id}" ${selectedIds.includes(wordbook.id) ? "checked" : ""} />
											<span>${escapeHtml(wordbook.name)}</span>
										</label>
									`
								)
								.join("")}
						</div>
					</label>

					<label>
						정렬 방식
						<select name="sort-mode">
							<option value="created-desc" ${this.defaults.sortMode === "created-desc" ? "selected" : ""}>추가된 날짜 최신순</option>
							<option value="created-asc" ${this.defaults.sortMode === "created-asc" ? "selected" : ""}>추가된 날짜 오래된순</option>
							<option value="term-asc" ${this.defaults.sortMode === "term-asc" ? "selected" : ""}>단어 오름차순</option>
							<option value="random" ${this.defaults.sortMode === "random" ? "selected" : ""}>랜덤</option>
						</select>
					</label>

					<label class="check-row">
						<input type="checkbox" name="use-forgetting-curve" ${this.defaults.useForgettingCurve ? "checked" : ""} />
						<span>망각곡선 적용</span>
					</label>

					<label>
						카드 앞면 기본 노출
						<div class="check-list">
							${Object.entries(fieldLabels)
								.map(
									([value, label]) => `
										<label class="check-row">
											<input type="checkbox" name="visible-field" value="${value}" ${visibleFields.includes(value) ? "checked" : ""} />
											<span>${label}</span>
										</label>
									`
								)
								.join("")}
						</div>
					</label>

					${this.error ? `<p class="error" role="alert">${this.error}</p>` : ""}

					<div class="dialog-actions">
						<button class="secondary" type="button" id="cancel-button">취소</button>
						<button class="primary" type="submit">시작</button>
					</div>
				</form>
			</dialog>
		`;

		this.shadowRoot.getElementById("close-button").addEventListener("click", () => this.close());
		this.shadowRoot.getElementById("cancel-button").addEventListener("click", () => this.close());
		this.shadowRoot.getElementById("study-form").addEventListener("submit", (event) => {
			this.handleSubmit(event);
		});
	}

	close() {
		this.shadowRoot.querySelector("dialog").close();
	}

	handleSubmit(event) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const wordbookIds = form.getAll("wordbook");
		const visibleFields = form.getAll("visible-field");

		if (wordbookIds.length === 0) {
			this.error = "학습할 단어장을 하나 이상 선택해 주세요.";
			this.render();
			this.shadowRoot.querySelector("dialog").showModal();
			return;
		}

		if (!hasVisibleStudyField(visibleFields)) {
			this.error = "카드 앞면에는 최소 한 항목을 노출해야 합니다.";
			this.render();
			this.shadowRoot.querySelector("dialog").showModal();
			return;
		}

		this.close();
		emit(this, "start-study", {
			wordbookIds,
			sortMode: String(form.get("sort-mode") || "created-desc"),
			useForgettingCurve: form.get("use-forgetting-curve") === "on",
			visibleFields,
		});
	}
}

customElements.define("study-setup-dialog", StudySetupDialog);
