import test from "node:test";
import assert from "node:assert/strict";
import {
	applyStudyAnswer,
	buildStudyQueue,
	filterWords,
	getReviewIntervalDays,
	normalizeWord,
	parseLines,
	shouldShowByForgettingCurve,
	sortWords,
} from "../src/domain/study-scheduler.js";

test("parseLines는 줄바꿈과 배열 입력을 공백 제거 배열로 바꾼다", () => {
	assert.deepEqual(parseLines(" apple \n\n banana\r\n cherry "), ["apple", "banana", "cherry"]);
	assert.deepEqual(parseLines([" a ", "", "b"]), ["a", "b"]);
	assert.deepEqual(parseLines(null), []);
});

test("normalizeWord는 기존 앱 필드를 새 표준 필드로 호환 변환한다", () => {
	const word = normalizeWord(
		{
			spelling: "abandon",
			pronunciation: "əˈbændən",
			meanings: ["버리다"],
			examples: "Do not abandon it.",
		},
		{ id: "w1", wordbookId: "book1" }
	);

	assert.equal(word.id, "w1");
	assert.equal(word.wordbookId, "book1");
	assert.equal(word.term, "abandon");
	assert.deepEqual(word.pronunciations, ["əˈbændən"]);
	assert.deepEqual(word.meanings, ["버리다"]);
	assert.deepEqual(word.examples, ["Do not abandon it."]);
});

test("망각곡선 간격은 1~7회는 횟수만큼, 8회 이상은 30일이다", () => {
	assert.equal(getReviewIntervalDays(0), 0);
	assert.equal(getReviewIntervalDays(1), 1);
	assert.equal(getReviewIntervalDays(7), 7);
	assert.equal(getReviewIntervalDays(8), 30);
	assert.equal(getReviewIntervalDays(20), 30);
});

test("shouldShowByForgettingCurve는 로컬 날짜 기준으로 복습 대상을 판단한다", () => {
	const now = new Date(2026, 4, 20, 9, 0, 0);

	assert.equal(
		shouldShowByForgettingCurve({ studyCount: 1, lastStudiedAt: new Date(2026, 4, 19, 23, 0, 0) }, now),
		true
	);
	assert.equal(
		shouldShowByForgettingCurve({ studyCount: 2, lastStudiedAt: new Date(2026, 4, 19, 1, 0, 0) }, now),
		false
	);
	assert.equal(
		shouldShowByForgettingCurve({ studyCount: 8, lastStudiedAt: new Date(2026, 3, 20, 1, 0, 0) }, now),
		true
	);
});

test("filterWords는 검색 범위와 망각곡선 필터를 함께 적용한다", () => {
	const words = [
		{
			term: "apple",
			pronunciations: ["a"],
			meanings: ["사과"],
			examples: ["red apple"],
			studyCount: 0,
		},
		{
			term: "pear",
			pronunciations: ["p"],
			meanings: ["배"],
			examples: ["green pear"],
			studyCount: 2,
			lastStudiedAt: new Date(2026, 4, 19),
		},
	];

	assert.deepEqual(filterWords(words, { query: "사과", scope: "meaning" }).map((word) => word.term), ["apple"]);
	assert.deepEqual(
		filterWords(words, { useForgettingCurve: true, now: new Date(2026, 4, 20) }).map((word) => word.term),
		["apple"]
	);
});

test("sortWords는 날짜, 단어, 랜덤 정렬을 제공한다", () => {
	const words = [
		{ term: "beta", createdAt: new Date(2026, 4, 10) },
		{ term: "alpha", createdAt: new Date(2026, 4, 12) },
	];

	assert.deepEqual(sortWords(words, "created-desc").map((word) => word.term), ["alpha", "beta"]);
	assert.deepEqual(sortWords(words, "created-asc").map((word) => word.term), ["beta", "alpha"]);
	assert.deepEqual(sortWords(words, "term-asc").map((word) => word.term), ["alpha", "beta"]);
});

test("buildStudyQueue는 학습 시작 직전 필터와 정렬을 적용한다", () => {
	const words = [
		{ term: "old", createdAt: new Date(2026, 4, 1), studyCount: 1, lastStudiedAt: new Date(2026, 4, 19) },
		{ term: "new", createdAt: new Date(2026, 4, 2), studyCount: 2, lastStudiedAt: new Date(2026, 4, 19) },
	];

	assert.deepEqual(
		buildStudyQueue(words, {
			sortMode: "created-asc",
			useForgettingCurve: true,
			now: new Date(2026, 4, 20),
		}).map((word) => word.term),
		["old"]
	);
});

test("applyStudyAnswer는 외움이면 제거하고 잊음이면 큐에 다시 넣는다", () => {
	const queue = [{ term: "a" }, { term: "b" }, { term: "c" }];

	assert.deepEqual(applyStudyAnswer(queue, { remembered: true }).queue.map((word) => word.term), ["b", "c"]);
	assert.deepEqual(
		applyStudyAnswer(queue, { remembered: false, sortMode: "created-desc" }).queue.map((word) => word.term),
		["b", "c", "a"]
	);
	assert.deepEqual(
		applyStudyAnswer(queue, { remembered: false, sortMode: "random", random: () => 0 }).queue.map((word) => word.term),
		["a", "b", "c"]
	);
});
