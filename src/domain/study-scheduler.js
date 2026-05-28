const dayMs = 24 * 60 * 60 * 1000;

/**
 * 여러 줄 입력이나 배열 값을 공백이 제거된 문자열 배열로 정규화합니다.
 *
 * @param {string|string[]|null|undefined} value 사용자가 입력한 원본 값입니다.
 * @returns {string[]} 빈 줄이 제거된 문자열 배열입니다.
 */
export function parseLines(value) {
	if (Array.isArray(value)) {
		return value.map((item) => String(item).trim()).filter(Boolean);
	}
	if (value == null) {
		return [];
	}
	return String(value)
		.split(/\r?\n/)
		.map((item) => item.trim())
		.filter(Boolean);
}

/**
 * Firestore Timestamp, Date, 문자열, 숫자를 JavaScript Date로 변환합니다.
 *
 * @param {unknown} value 변환할 날짜 값입니다.
 * @returns {Date|null} 유효한 날짜이면 Date, 아니면 null입니다.
 */
export function toDate(value) {
	if (!value) {
		return null;
	}
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	if (typeof value === "object" && typeof value.toDate === "function") {
		return value.toDate();
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 시각 정보를 버리고 로컬 날짜의 자정으로 맞춥니다.
 *
 * 망각곡선은 사용자가 체감하는 날짜 기준으로 계산해야 하므로 UTC가 아니라
 * 브라우저 로컬 날짜를 기준으로 합니다.
 *
 * @param {Date} date 기준 날짜입니다.
 * @returns {Date} 로컬 자정 날짜입니다.
 */
export function toLocalDateOnly(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * 두 날짜 사이에 지난 로컬 날짜 수를 계산합니다.
 *
 * @param {Date} fromDate 과거 날짜입니다.
 * @param {Date} toDateValue 기준 날짜입니다.
 * @returns {number} 지난 날짜 수입니다. 미래 날짜는 0으로 처리합니다.
 */
export function daysBetweenLocalDates(fromDate, toDateValue = new Date()) {
	const start = toLocalDateOnly(fromDate);
	const end = toLocalDateOnly(toDateValue);
	return Math.max(0, Math.floor((end.getTime() - start.getTime()) / dayMs));
}

/**
 * 외운 횟수에 따라 다음 노출까지 필요한 날짜 수를 계산합니다.
 *
 * @param {number} studyCount 외운 횟수입니다.
 * @returns {number} 다음 노출까지 필요한 날짜 수입니다.
 */
export function getReviewIntervalDays(studyCount) {
	if (studyCount <= 0) {
		return 0;
	}
	if (studyCount >= 8) {
		return 30;
	}
	return studyCount;
}

/**
 * 기존 앱과 새 앱의 단어 필드를 하나의 표준 모델로 변환합니다.
 *
 * @param {Record<string, unknown>} raw Firestore에서 읽은 단어 문서입니다.
 * @param {object} [options] 보조 옵션입니다.
 * @param {string} [options.id] 문서 ID입니다.
 * @param {string} [options.wordbookId] 단어장 ID입니다.
 * @returns {object} UI와 학습 로직에서 쓰는 표준 단어 객체입니다.
 */
export function normalizeWord(raw, options = {}) {
	const pronunciations = [
		...parseLines(raw.pronunciations),
		...parseLines(raw.pronunciation),
		...parseLines(raw.onyomi),
		...parseLines(raw.kunyomi),
	].filter((value, index, list) => list.indexOf(value) === index);

	const term = String(raw.term || raw.spelling || raw.kanji || "").trim();
	const meanings = parseLines(raw.meanings);
	const examples = parseLines(raw.examples);
	const confusingSynonyms = [
		...parseLines(raw.confusingSynonyms),
		...parseLines(raw.confusingSynonym),
	].filter((value, index, list) => list.indexOf(value) === index);
	const createdAt = toDate(raw.createdAt) || new Date(0);
	const updatedAt = toDate(raw.updatedAt);
	const lastStudiedAt = toDate(raw.lastStudiedAt);

	return {
		...raw,
		id: options.id || raw.id || "",
		wordbookId: options.wordbookId || raw.wordbookId || "",
		term,
		pronunciations,
		meanings,
		examples,
		confusingSynonyms,
		createdAt,
		updatedAt,
		studyCount: Number(raw.studyCount || 0),
		lastStudiedAt,
	};
}

/**
 * 단어가 오늘 다시 노출되어야 하는지 망각곡선 규칙으로 판단합니다.
 *
 * @param {object} word 표준 단어 객체입니다.
 * @param {Date} [now] 기준 날짜입니다.
 * @returns {boolean} 오늘 학습 대상이면 true입니다.
 */
export function shouldShowByForgettingCurve(word, now = new Date()) {
	const studyCount = Number(word.studyCount || 0);
	if (studyCount <= 0) {
		return true;
	}
	const lastStudiedAt = toDate(word.lastStudiedAt);
	if (!lastStudiedAt) {
		return true;
	}
	return daysBetweenLocalDates(lastStudiedAt, now) >= getReviewIntervalDays(studyCount);
}

/**
 * 단어 객체에서 검색 대상 문자열을 추출합니다.
 *
 * @param {object} word 표준 단어 객체입니다.
 * @param {"all"|"term"|"pronunciation"|"meaning"|"example"|"synonym"} scope 검색 범위입니다.
 * @returns {string} 검색에 사용할 문자열입니다.
 */
export function getSearchText(word, scope = "all") {
	const textMap = {
		term: [word.term],
		pronunciation: word.pronunciations || [],
		meaning: word.meanings || [],
		example: word.examples || [],
		synonym: word.confusingSynonyms || [],
		all: [
			word.term,
			...(word.pronunciations || []),
			...(word.meanings || []),
			...(word.examples || []),
			...(word.confusingSynonyms || []),
		],
	};
	return (textMap[scope] || textMap.all).join("\n").toLowerCase();
}

/**
 * 검색어와 망각곡선 옵션에 맞는 단어만 남깁니다.
 *
 * @param {object[]} words 표준 단어 배열입니다.
 * @param {object} options 필터 옵션입니다.
 * @param {string} [options.query] 검색어입니다.
 * @param {"all"|"term"|"pronunciation"|"meaning"|"example"|"synonym"} [options.scope] 검색 범위입니다.
 * @param {boolean} [options.useForgettingCurve] 망각곡선 적용 여부입니다.
 * @param {Date} [options.now] 기준 날짜입니다.
 * @returns {object[]} 필터링된 단어 배열입니다.
 */
export function filterWords(words, options = {}) {
	const query = String(options.query || "").trim().toLowerCase();
	const scope = options.scope || "all";
	const now = options.now || new Date();
	return words.filter((word) => {
		if (options.useForgettingCurve && !shouldShowByForgettingCurve(word, now)) {
			return false;
		}
		if (!query) {
			return true;
		}
		return getSearchText(word, scope).includes(query);
	});
}

/**
 * 단어 목록을 지정된 방식으로 정렬합니다.
 *
 * @param {object[]} words 표준 단어 배열입니다.
 * @param {"created-desc"|"created-asc"|"term-asc"|"random"} sortMode 정렬 방식입니다.
 * @param {() => number} [random] 테스트 가능한 난수 함수입니다.
 * @returns {object[]} 새로 정렬된 단어 배열입니다.
 */
export function sortWords(words, sortMode = "created-desc", random = Math.random) {
	const items = [...words];
	if (sortMode === "created-asc") {
		return items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	}
	if (sortMode === "term-asc") {
		return items.sort((a, b) => a.term.localeCompare(b.term, "ko"));
	}
	if (sortMode === "random") {
		for (let index = items.length - 1; index > 0; index -= 1) {
			const target = Math.floor(random() * (index + 1));
			[items[index], items[target]] = [items[target], items[index]];
		}
		return items;
	}
	return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * 학습 시작 직전 설정에 맞는 학습 큐를 만듭니다.
 *
 * @param {object[]} words 표준 단어 배열입니다.
 * @param {object} settings 학습 설정입니다.
 * @param {"created-desc"|"created-asc"|"term-asc"|"random"} settings.sortMode 정렬 방식입니다.
 * @param {boolean} settings.useForgettingCurve 망각곡선 적용 여부입니다.
 * @param {Date} [settings.now] 기준 날짜입니다.
 * @returns {object[]} 학습에 사용할 단어 큐입니다.
 */
export function buildStudyQueue(words, settings) {
	return sortWords(
		filterWords(words, {
			useForgettingCurve: settings.useForgettingCurve,
			now: settings.now,
		}),
		settings.sortMode
	);
}

/**
 * 학습 응답 후 남은 큐를 계산합니다.
 *
 * `잊음`을 누른 단어는 랜덤 정렬이면 남은 큐의 랜덤 위치에, 그 외 정렬이면 맨 뒤에
 * 다시 삽입합니다. `외움`은 현재 단어를 큐에서 제거합니다.
 *
 * @param {object[]} queue 현재 학습 큐입니다.
 * @param {object} options 응답 옵션입니다.
 * @param {number} [options.currentIndex] 현재 단어 위치입니다.
 * @param {boolean} options.remembered 외웠는지 여부입니다.
 * @param {"created-desc"|"created-asc"|"term-asc"|"random"} [options.sortMode] 정렬 방식입니다.
 * @param {() => number} [options.random] 테스트 가능한 난수 함수입니다.
 * @returns {{queue: object[], currentIndex: number}} 변경된 큐와 다음 위치입니다.
 */
export function applyStudyAnswer(queue, options) {
	const currentIndex = options.currentIndex || 0;
	const random = options.random || Math.random;
	const nextQueue = [...queue];
	const [word] = nextQueue.splice(currentIndex, 1);

	if (word && !options.remembered) {
		if (options.sortMode === "random") {
			const availableSlots = nextQueue.length - currentIndex + 1;
			const insertIndex = currentIndex + Math.floor(random() * Math.max(1, availableSlots));
			nextQueue.splice(insertIndex, 0, word);
		} else {
			nextQueue.push(word);
		}
	}

	return {
		queue: nextQueue,
		currentIndex: Math.min(currentIndex, Math.max(0, nextQueue.length - 1)),
	};
}

/**
 * 학습 화면의 기본 노출 필드가 유효한지 확인합니다.
 *
 * @param {string[]} fields 선택된 노출 필드입니다.
 * @returns {boolean} 최소 한 개 이상 선택되었으면 true입니다.
 */
export function hasVisibleStudyField(fields) {
	return Array.isArray(fields) && fields.length > 0;
}
