import { firebaseConfig } from "/config/firebase-config.js";
import { normalizeWord, parseLines, toDate } from "../domain/study-scheduler.js";

let firebaseContextPromise = null;

/**
 * Firebase CDN 모듈을 필요한 순간에 불러오고 앱 인스턴스를 초기화합니다.
 *
 * 최상위 정적 import를 피하면 네트워크가 일시적으로 막힌 개발 환경에서도 앱 전체가
 * 빈 화면으로 멈추지 않고 오류 상태를 표시할 수 있습니다.
 *
 * @returns {Promise<object>} Firebase 앱, 인증, Firestore 함수 묶음입니다.
 */
async function getFirebaseContext() {
	if (!firebaseContextPromise) {
		firebaseContextPromise = Promise.all([
			import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
			import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
			import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
		]).then(([appModule, authModule, firestoreModule]) => {
			const app =
				appModule.getApps().length === 0
					? appModule.initializeApp(firebaseConfig)
					: appModule.getApps()[0];
			return {
				app,
				auth: authModule.getAuth(app),
				db: firestoreModule.getFirestore(app),
				...authModule,
				...firestoreModule,
			};
		});
	}
	return firebaseContextPromise;
}

/**
 * Firebase 인증 상태 변화를 구독합니다.
 *
 * 로그인된 사용자는 기존 앱과 호환되는 `userProfiles/{uid}` 문서가 유지되도록
 * 즉시 생성 또는 갱신합니다.
 *
 * @param {(user: import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js").User|null) => void} callback 인증 상태 콜백입니다.
 * @returns {() => void} 구독 해제 함수입니다.
 */
export function observeAuthState(callback) {
	let unsubscribe = () => {};
	getFirebaseContext()
		.then(({ auth, onAuthStateChanged }) => {
			unsubscribe = onAuthStateChanged(
				auth,
				async (user) => {
					if (user) {
						await createOrUpdateUserProfile(user);
					}
					callback(user, null);
				},
				(error) => callback(null, error)
			);
		})
		.catch((error) => callback(null, error));
	return () => unsubscribe();
}

/**
 * 이메일과 비밀번호로 로그인합니다.
 *
 * @param {string} email 이메일 주소입니다.
 * @param {string} password 비밀번호입니다.
 * @returns {Promise<void>} 로그인 완료 Promise입니다.
 */
export async function signInWithEmail(email, password) {
	const { auth, signInWithEmailAndPassword } = await getFirebaseContext();
	await signInWithEmailAndPassword(auth, email, password);
}

/**
 * 이메일과 비밀번호로 새 계정을 만듭니다.
 *
 * @param {string} email 이메일 주소입니다.
 * @param {string} password 비밀번호입니다.
 * @returns {Promise<void>} 가입 완료 Promise입니다.
 */
export async function createAccountWithEmail(email, password) {
	const { auth, createUserWithEmailAndPassword } = await getFirebaseContext();
	await createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Google 팝업 인증으로 로그인합니다.
 *
 * @returns {Promise<void>} 로그인 완료 Promise입니다.
 */
export async function signInWithGoogle() {
	const { auth, GoogleAuthProvider, signInWithPopup } = await getFirebaseContext();
	const provider = new GoogleAuthProvider();
	await signInWithPopup(auth, provider);
}

/**
 * 현재 사용자를 로그아웃합니다.
 *
 * @returns {Promise<void>} 로그아웃 완료 Promise입니다.
 */
export async function signOutUser() {
	const { auth, signOut } = await getFirebaseContext();
	await signOut(auth);
}

/**
 * 사용자 프로필 문서를 생성하거나 최신 로그인 정보로 갱신합니다.
 *
 * @param {object} user Firebase Auth 사용자 객체입니다.
 * @returns {Promise<void>} 저장 완료 Promise입니다.
 */
export async function createOrUpdateUserProfile(user) {
	const { db, doc, serverTimestamp, setDoc } = await getFirebaseContext();
	await setDoc(
		doc(db, "userProfiles", user.uid),
		{
			email: String(user.email || "").toLowerCase(),
			displayName: user.displayName || null,
			createdAt: serverTimestamp(),
			lastUpdated: serverTimestamp(),
		},
		{ merge: true }
	);
}

/**
 * 사용자가 접근 가능한 단어장 목록을 가져옵니다.
 *
 * Firestore에서는 협업자 배열 조건만 사용하고, 정렬은 클라이언트에서 처리합니다.
 * 이렇게 하면 기존 DB에 추가 인덱스를 요구하지 않습니다.
 *
 * @param {string} uid 사용자 UID입니다.
 * @returns {Promise<object[]>} 단어장 배열입니다.
 */
export async function getUserWordbooks(uid) {
	const { db, collection, getDocs, query, where } = await getFirebaseContext();
	const snapshot = await getDocs(
		query(collection(db, "wordbooks"), where("collaborators", "array-contains", uid))
	);
	return snapshot.docs
		.map((item) => normalizeWordbook(item.id, item.data()))
		.sort((a, b) => a.order - b.order || b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * 단어장 문서를 하나 가져옵니다.
 *
 * @param {string} wordbookId 단어장 ID입니다.
 * @returns {Promise<object|null>} 단어장 객체 또는 null입니다.
 */
export async function getWordbook(wordbookId) {
	const { db, doc, getDoc } = await getFirebaseContext();
	const snapshot = await getDoc(doc(db, "wordbooks", wordbookId));
	return snapshot.exists() ? normalizeWordbook(snapshot.id, snapshot.data()) : null;
}

/**
 * 새 단어장을 생성합니다.
 *
 * @param {string} name 단어장 이름입니다.
 * @param {object} user Firebase Auth 사용자입니다.
 * @returns {Promise<string>} 생성된 단어장 ID입니다.
 */
export async function createWordbook(name, user) {
	const { db, addDoc, collection, serverTimestamp } = await getFirebaseContext();
	const nowOrder = Date.now();
	const docRef = await addDoc(collection(db, "wordbooks"), {
		name,
		language: "english",
		createdBy: user.uid,
		collaborators: [user.uid],
		order: nowOrder,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	return docRef.id;
}

/**
 * 단어장 이름을 수정합니다.
 *
 * @param {string} wordbookId 단어장 ID입니다.
 * @param {string} name 새 이름입니다.
 * @returns {Promise<void>} 수정 완료 Promise입니다.
 */
export async function updateWordbookName(wordbookId, name) {
	const { db, doc, serverTimestamp, updateDoc } = await getFirebaseContext();
	await updateDoc(doc(db, "wordbooks", wordbookId), {
		name,
		updatedAt: serverTimestamp(),
	});
}

/**
 * 드래그 앤 드롭으로 바뀐 단어장 순서를 저장합니다.
 *
 * @param {object[]} wordbooks 정렬된 단어장 배열입니다.
 * @returns {Promise<void>} 저장 완료 Promise입니다.
 */
export async function updateWordbookOrder(wordbooks) {
	const { db, doc, serverTimestamp, writeBatch } = await getFirebaseContext();
	const batch = writeBatch(db);
	wordbooks.forEach((wordbook, index) => {
		batch.update(doc(db, "wordbooks", wordbook.id), {
			order: index,
			updatedAt: serverTimestamp(),
		});
	});
	await batch.commit();
}

/**
 * 단어장을 삭제합니다.
 *
 * 클라이언트 SDK는 모든 하위 컬렉션을 재귀 삭제할 수 없으므로 현재 앱이 관리하는
 * 단어와 현재 사용자 통계를 먼저 삭제하고 단어장 문서를 삭제합니다.
 *
 * @param {string} wordbookId 단어장 ID입니다.
 * @param {string} uid 현재 사용자 UID입니다.
 * @returns {Promise<void>} 삭제 완료 Promise입니다.
 */
export async function deleteWordbook(wordbookId, uid) {
	const { db, collection, doc, getDocs, writeBatch } = await getFirebaseContext();
	const wordsSnapshot = await getDocs(collection(db, "wordbooks", wordbookId, "words"));
	const statsSnapshot = await getDocs(collection(db, "wordbooks", wordbookId, "userStats", uid, "words"));
	const batch = writeBatch(db);
	wordsSnapshot.docs.forEach((item) => batch.delete(item.ref));
	statsSnapshot.docs.forEach((item) => batch.delete(item.ref));
	batch.delete(doc(db, "wordbooks", wordbookId));
	await batch.commit();
}

/**
 * 단어장 안의 단어 목록을 가져옵니다.
 *
 * @param {string} wordbookId 단어장 ID입니다.
 * @returns {Promise<object[]>} 표준화된 단어 배열입니다.
 */
export async function getWordsFromWordbook(wordbookId) {
	const { db, collection, getDocs } = await getFirebaseContext();
	const snapshot = await getDocs(collection(db, "wordbooks", wordbookId, "words"));
	return snapshot.docs.map((item) => normalizeWord(item.data(), { id: item.id, wordbookId }));
}

/**
 * 여러 단어장의 단어를 순차적으로 가져옵니다.
 *
 * 한 번에 너무 많은 복합 쿼리를 만들지 않고 단어장 단위로만 읽어 기존 보안 규칙과
 * 인덱스에 의존하지 않도록 합니다.
 *
 * @param {string[]} wordbookIds 단어장 ID 배열입니다.
 * @returns {Promise<object[]>} 모든 단어 배열입니다.
 */
export async function getWordsFromWordbooks(wordbookIds) {
	const groups = await Promise.all(wordbookIds.map((wordbookId) => getWordsFromWordbook(wordbookId)));
	return groups.flat();
}

/**
 * 단어장에 새 단어를 추가합니다.
 *
 * @param {string} wordbookId 단어장 ID입니다.
 * @param {object} input 단어 입력값입니다.
 * @param {object} user Firebase Auth 사용자입니다.
 * @returns {Promise<string>} 생성된 단어 ID입니다.
 */
export async function createWord(wordbookId, input, user) {
	const { db, addDoc, collection, serverTimestamp } = await getFirebaseContext();
	const payload = toWordPayload(input, {
		createdBy: user.uid,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	const docRef = await addDoc(collection(db, "wordbooks", wordbookId, "words"), payload);
	return docRef.id;
}

/**
 * 기존 단어를 수정합니다.
 *
 * @param {string} wordbookId 단어장 ID입니다.
 * @param {string} wordId 단어 ID입니다.
 * @param {object} input 단어 입력값입니다.
 * @returns {Promise<void>} 수정 완료 Promise입니다.
 */
export async function updateWord(wordbookId, wordId, input) {
	const { db, doc, serverTimestamp, updateDoc } = await getFirebaseContext();
	await updateDoc(doc(db, "wordbooks", wordbookId, "words", wordId), toWordPayload(input, {
		updatedAt: serverTimestamp(),
	}));
}

/**
 * 단어를 삭제합니다.
 *
 * @param {string} wordbookId 단어장 ID입니다.
 * @param {string} wordId 단어 ID입니다.
 * @returns {Promise<void>} 삭제 완료 Promise입니다.
 */
export async function deleteWord(wordbookId, wordId) {
	const { db, deleteDoc, doc } = await getFirebaseContext();
	await deleteDoc(doc(db, "wordbooks", wordbookId, "words", wordId));
}

/**
 * 사용자의 단어별 학습 통계를 가져옵니다.
 *
 * @param {string} wordbookId 단어장 ID입니다.
 * @param {string} uid 사용자 UID입니다.
 * @returns {Promise<Record<string, object>>} 단어 ID를 키로 하는 통계 객체입니다.
 */
export async function getUserWordStats(wordbookId, uid) {
	const { db, collection, getDocs } = await getFirebaseContext();
	const snapshot = await getDocs(collection(db, "wordbooks", wordbookId, "userStats", uid, "words"));
	const stats = {};
	snapshot.docs.forEach((item) => {
		const data = item.data();
		stats[item.id] = {
			studyCount: Number(data.studyCount || 0),
			lastStudiedAt: toDate(data.lastStudiedAt),
		};
	});
	return stats;
}

/**
 * 여러 단어장의 사용자 학습 통계를 가져옵니다.
 *
 * @param {string[]} wordbookIds 단어장 ID 배열입니다.
 * @param {string} uid 사용자 UID입니다.
 * @returns {Promise<Record<string, Record<string, object>>>} 단어장 ID와 단어 ID로 접근하는 통계입니다.
 */
export async function getUserWordStatsForWordbooks(wordbookIds, uid) {
	const entries = await Promise.all(
		wordbookIds.map(async (wordbookId) => [wordbookId, await getUserWordStats(wordbookId, uid)])
	);
	return Object.fromEntries(entries);
}

/**
 * 학습 결과를 저장합니다.
 *
 * `외움`은 `studyCount`를 1 증가시키고, `잊음`은 0으로 초기화합니다.
 *
 * @param {object} options 학습 결과입니다.
 * @param {string} options.wordbookId 단어장 ID입니다.
 * @param {string} options.wordId 단어 ID입니다.
 * @param {string} options.uid 사용자 UID입니다.
 * @param {boolean} options.remembered 외웠는지 여부입니다.
 * @returns {Promise<void>} 저장 완료 Promise입니다.
 */
export async function updateStudyResult({ wordbookId, wordId, uid, remembered }) {
	const { db, doc, increment, serverTimestamp, setDoc } = await getFirebaseContext();
	const statRef = doc(db, "wordbooks", wordbookId, "userStats", uid, "words", wordId);
	await setDoc(
		statRef,
		{
			studyCount: remembered ? increment(1) : 0,
			lastStudiedAt: serverTimestamp(),
		},
		{ merge: true }
	);
}

/**
 * 단어장 Firestore 문서를 UI용 객체로 정규화합니다.
 *
 * @param {string} id 문서 ID입니다.
 * @param {Record<string, unknown>} data Firestore 데이터입니다.
 * @returns {object} 정규화된 단어장입니다.
 */
function normalizeWordbook(id, data) {
	const createdAt = toDate(data.createdAt) || new Date(0);
	return {
		id,
		name: String(data.name || "이름 없는 단어장"),
		createdBy: String(data.createdBy || ""),
		collaborators: Array.isArray(data.collaborators) ? data.collaborators : [],
		language: String(data.language || "english"),
		order: Number.isFinite(Number(data.order)) ? Number(data.order) : createdAt.getTime(),
		createdAt,
		updatedAt: toDate(data.updatedAt),
	};
}

/**
 * 단어 입력값을 기존 앱 호환 필드까지 포함한 Firestore 저장 객체로 변환합니다.
 *
 * @param {object} input 사용자가 입력한 단어 값입니다.
 * @param {object} extra 생성자, timestamp 같은 추가 필드입니다.
 * @returns {object} Firestore 저장 객체입니다.
 */
function toWordPayload(input, extra = {}) {
	const term = String(input.term || "").trim();
	const pronunciations = parseLines(input.pronunciations);
	const meanings = parseLines(input.meanings);
	const examples = parseLines(input.examples);

	return {
		term,
		pronunciations,
		meanings,
		examples,
		spelling: term,
		pronunciation: pronunciations.join("\n"),
		...extra,
	};
}
