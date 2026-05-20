/**
 * HTML 템플릿에 사용자 입력 문자열을 넣기 전에 이스케이프합니다.
 *
 * @param {unknown} value 원본 값입니다.
 * @returns {string} HTML 엔티티로 이스케이프된 문자열입니다.
 */
export function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

/**
 * 날짜 값을 화면 표시용 `YYYY-MM-DD` 문자열로 변환합니다.
 *
 * @param {Date|null|undefined} value 날짜 값입니다.
 * @returns {string} 표시 문자열입니다.
 */
export function formatDate(value) {
	if (!value) {
		return "-";
	}
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0"),
	].join("-");
}

/**
 * Shadow DOM 경계를 넘어 부모 앱으로 CustomEvent를 전달합니다.
 *
 * @param {HTMLElement} target 이벤트를 발생시킬 요소입니다.
 * @param {string} name 이벤트 이름입니다.
 * @param {unknown} detail 이벤트 데이터입니다.
 * @returns {void}
 */
export function emit(target, name, detail = undefined) {
	target.dispatchEvent(
		new CustomEvent(name, {
			bubbles: true,
			composed: true,
			detail,
		})
	);
}

/**
 * 줄 배열을 줄바꿈이 유지되는 HTML 목록으로 렌더링합니다.
 *
 * @param {string[]} values 표시할 문자열 배열입니다.
 * @returns {string} 목록 HTML입니다.
 */
export function renderLines(values) {
	if (!values || values.length === 0) {
		return `<span class="muted">-</span>`;
	}
	return `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

/**
 * 폼 제출 중 버튼 상태를 잠시 잠급니다.
 *
 * @param {HTMLButtonElement|null} button 대상 버튼입니다.
 * @param {boolean} loading 로딩 여부입니다.
 * @returns {void}
 */
export function setButtonLoading(button, loading) {
	if (!button) {
		return;
	}
	button.disabled = loading;
	button.dataset.originalText ||= button.textContent || "";
	button.textContent = loading ? "처리 중" : button.dataset.originalText;
}
