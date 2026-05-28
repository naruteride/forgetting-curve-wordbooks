import { parseLines } from "./study-scheduler.js";

const requiredHeaders = ["표기", "읽기", "한국어 뜻"];
const optionalHeaders = ["예문", "헷갈리는 유의어"];

/**
 * CSV 텍스트를 단어 추가 입력값으로 변환합니다.
 *
 * 브라우저의 `File.text()`로 읽은 UTF-8 CSV 문자열을 받아 RFC 4180에 가까운 규칙으로
 * 파싱합니다. 따옴표로 감싼 쉼표, 따옴표 이스케이프, CRLF 줄바꿈, UTF-8 BOM을 처리하고,
 * 기존 단어 및 같은 파일 안에서 이미 나온 `표기`는 중복으로 제외합니다.
 *
 * @param {string} csvText 업로드된 CSV 원문입니다.
 * @param {object[]} [existingWords] 현재 단어장에 이미 있는 단어 배열입니다.
 * @returns {{words: object[], duplicateCount: number, invalidCount: number, totalRows: number}} 가져오기 결과입니다.
 * @throws {Error} 필수 헤더가 없거나 CSV를 읽을 수 없는 경우 오류를 던집니다.
 */
export function parseCsvWords(csvText, existingWords = []) {
	const rows = parseCsvRows(csvText);
	const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell).trim()));

	if (headerIndex < 0) {
		throw new Error("CSV 파일에 헤더가 없습니다.");
	}

	const headers = rows[headerIndex].map((header) => String(header).trim());
	const headerMap = createHeaderMap(headers);
	const missingHeaders = requiredHeaders.filter((header) => !headerMap.has(header));

	if (missingHeaders.length > 0) {
		throw new Error(`CSV 필수 헤더가 없습니다: ${missingHeaders.join(", ")}`);
	}

	const existingKeys = new Set(existingWords.map((word) => getDuplicateKey(word?.term)));
	const importedKeys = new Set();
	const words = [];
	let duplicateCount = 0;
	let invalidCount = 0;
	let totalRows = 0;

	rows.slice(headerIndex + 1).forEach((row) => {
		if (isEmptyRow(row)) {
			return;
		}

		totalRows += 1;
		const term = getCell(row, headerMap, "표기").trim();
		const key = getDuplicateKey(term);

		if (!key) {
			invalidCount += 1;
			return;
		}

		if (existingKeys.has(key) || importedKeys.has(key)) {
			duplicateCount += 1;
			return;
		}

		importedKeys.add(key);
		words.push({
			term,
			pronunciations: parseLines(getCell(row, headerMap, "읽기")),
			meanings: parseLines(getCell(row, headerMap, "한국어 뜻")),
			examples: parseLines(getCell(row, headerMap, "예문")),
			confusingSynonyms: parseLines(getCell(row, headerMap, "헷갈리는 유의어")),
		});
	});

	return {
		words,
		duplicateCount,
		invalidCount,
		totalRows,
	};
}

/**
 * CSV 텍스트를 2차원 문자열 배열로 파싱합니다.
 *
 * @param {string} csvText CSV 원문입니다.
 * @returns {string[][]} 행과 열로 나뉜 문자열 배열입니다.
 */
export function parseCsvRows(csvText) {
	if (typeof csvText !== "string") {
		throw new Error("CSV 파일을 문자열로 읽지 못했습니다.");
	}

	const text = csvText.replace(/^\uFEFF/, "");
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		const nextChar = text[index + 1];

		if (inQuotes) {
			if (char === '"' && nextChar === '"') {
				field += '"';
				index += 1;
			} else if (char === '"') {
				inQuotes = false;
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\r" || char === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			if (char === "\r" && nextChar === "\n") {
				index += 1;
			}
		} else {
			field += char;
		}
	}

	row.push(field);
	if (!isTrailingEmptyRow(row, rows.length, text)) {
		rows.push(row);
	}

	return rows;
}

/**
 * 헤더 이름으로 CSV 열 위치를 찾을 수 있는 Map을 만듭니다.
 *
 * @param {string[]} headers CSV 헤더 배열입니다.
 * @returns {Map<string, number>} 헤더명과 열 번호 Map입니다.
 */
function createHeaderMap(headers) {
	const headerMap = new Map();
	[...requiredHeaders, ...optionalHeaders].forEach((header) => {
		const index = headers.indexOf(header);
		if (index >= 0) {
			headerMap.set(header, index);
		}
	});
	return headerMap;
}

/**
 * 특정 헤더에 해당하는 셀 값을 안전하게 가져옵니다.
 *
 * @param {string[]} row CSV 행입니다.
 * @param {Map<string, number>} headerMap 헤더 위치 Map입니다.
 * @param {string} header 가져올 헤더 이름입니다.
 * @returns {string} 셀 문자열입니다.
 */
function getCell(row, headerMap, header) {
	const index = headerMap.get(header);
	if (index == null) {
		return "";
	}
	return String(row[index] || "");
}

/**
 * 표기 중복 비교에 사용할 키를 만듭니다.
 *
 * @param {unknown} term 단어 표기입니다.
 * @returns {string} 앞뒤 공백을 제거한 중복 비교 키입니다.
 */
function getDuplicateKey(term) {
	return String(term || "").trim();
}

/**
 * CSV 행이 완전히 비어 있는지 확인합니다.
 *
 * @param {string[]} row CSV 행입니다.
 * @returns {boolean} 모든 셀이 비어 있으면 true입니다.
 */
function isEmptyRow(row) {
	return row.every((cell) => String(cell).trim() === "");
}

/**
 * 파일 마지막 줄바꿈 때문에 생긴 빈 행인지 확인합니다.
 *
 * @param {string[]} row 마지막 후보 행입니다.
 * @param {number} rowCount 이미 확정된 행 수입니다.
 * @param {string} text CSV 원문입니다.
 * @returns {boolean} 마지막 줄바꿈의 부산물이면 true입니다.
 */
function isTrailingEmptyRow(row, rowCount, text) {
	return rowCount > 0 && isEmptyRow(row) && /[\r\n]$/.test(text);
}
