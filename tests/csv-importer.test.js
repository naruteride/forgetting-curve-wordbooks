import test from "node:test";
import assert from "node:assert/strict";
import { parseCsvRows, parseCsvWords } from "../src/domain/csv-importer.js";

test("parseCsvWords는 샘플 CSV 헤더를 단어 입력값으로 매핑한다", () => {
	const csv = [
		"표기,읽기,품사,한국어 뜻,예문,헷갈리는 유의어,오답횟수",
		"配布,はいふ,명사/する동사,배포,会議の前に資料を配布する。,配る,0",
	].join("\n");
	const result = parseCsvWords(csv);

	assert.equal(result.totalRows, 1);
	assert.deepEqual(result.words, [
		{
			term: "配布",
			pronunciations: ["はいふ"],
			meanings: ["배포"],
			examples: ["会議の前に資料を配布する。"],
			confusingSynonyms: ["配る"],
		},
	]);
	assert.equal(Object.hasOwn(result.words[0], "품사"), false);
	assert.equal(Object.hasOwn(result.words[0], "오답횟수"), false);
});

test("parseCsvWords는 기존 단어와 파일 내부 중복을 표기 기준으로 제외한다", () => {
	const csv = [
		"표기,읽기,한국어 뜻,예문,헷갈리는 유의어",
		"既存,きそん,기존,既存の資料を見る。,前からある",
		"新規,しんき,신규,新規の申請をする。,新しい",
		"新規,しんき,중복,중복 행,新しい",
		"   ,よみ,빈 표기,표기가 없다,",
	].join("\n");
	const result = parseCsvWords(csv, [{ term: "既存" }]);

	assert.deepEqual(result.words.map((word) => word.term), ["新規"]);
	assert.equal(result.duplicateCount, 2);
	assert.equal(result.invalidCount, 1);
	assert.equal(result.totalRows, 4);
});

test("parseCsvWords는 BOM, CRLF, 따옴표와 쉼표가 포함된 값을 처리한다", () => {
	const csv = "\uFEFF표기,읽기,한국어 뜻,예문,헷갈리는 유의어\r\n" +
		"資料,しりょう,자료,\"会議で, 資料を配る。\",\"\"\"材料\"\"\"\r\n\r\n";
	const result = parseCsvWords(csv);

	assert.deepEqual(result.words[0], {
		term: "資料",
		pronunciations: ["しりょう"],
		meanings: ["자료"],
		examples: ["会議で, 資料を配る。"],
		confusingSynonyms: ['"材料"'],
	});
	assert.equal(result.totalRows, 1);
});

test("parseCsvRows는 CSV 원문을 행과 열 배열로 파싱한다", () => {
	assert.deepEqual(parseCsvRows('a,b\n"c,d","e""f"'), [
		["a", "b"],
		["c,d", 'e"f'],
	]);
});
