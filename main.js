import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase 설정
let firebaseConfig = {};
try {
    firebaseConfig = typeof window.__firebase_config__ === 'string' 
        ? JSON.parse(window.__firebase_config__) 
        : (window.__firebase_config__ || {});
} catch (e) {
    console.error("Firebase config parse error:", e);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof window.__app_id__ !== 'undefined' ? window.__app_id__ : 'parking-app-html-v1';

const TARGET_COORDS = { lat: 37.5078621, lng: 126.8960119 }; // 하나아파텔
const PROXIMITY_RADIUS = 200;

let currentUser = null;
let activeFloor = 'B1';
let parkingData = { 'B1': {}, 'B2': {}, 'B3': {} };

const parkingLayout = [
    { id: '101', type: 'small', label: '101' },
    { id: '102', type: 'wide', label: '102' },
    { id: '103', type: 'wide', label: '103' },
    { id: '104', type: 'medium', label: '104' },
    { id: '201', type: 'small', label: '201' },
    { id: '202', type: 'extra-wide', label: '202' },
    { id: '203', type: 'medium', label: '203' },
    { id: '301', type: 'tall', label: '301' },
    { id: '302', type: 'square', label: '302' },
    { id: '303', type: 'square', label: '303' },
    { id: '304', type: 'tall', label: '304' },
];

// 에러 표시 함수
function showError(msg) {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.innerHTML = `<div class="p-6 text-center">
            <div class="text-red-500 mb-4"><i data-lucide="alert-circle" class="w-12 h-12 mx-auto"></i></div>
            <p class="text-red-600 font-bold mb-2">연결 오류 발생</p>
            <p class="text-xs text-slate-500 break-all">${msg}</p>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">다시 시도</button>
        </div>`;
        lucide.createIcons();
    }
}

// 초기화 함수
async function init() {
    lucide.createIcons();
    console.log("App initializing...");
    
    // 익명 로그인 상태 감시
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Authenticated as:", user.uid);
            currentUser = user;
            startDataSync();
        } else {
            console.log("No user, signing in anonymously...");
            signInAnonymously(auth).catch(err => {
                console.error("Auth Error:", err);
                showError("인증에 실패했습니다. Firebase 콘솔에서 '익명 로그인'이 활성화되어 있는지 확인해 주세요. (" + err.code + ")");
            });
        }
    });

    startGpsTracking();
}

// 데이터 동기화
function startDataSync() {
    if (!currentUser) return;
    console.log("Starting data sync for:", currentUser.uid);
    
    const parkingCol = collection(db, 'artifacts', appId, 'users', currentUser.uid, 'parking');
    
    // 타임아웃 설정 (10초 후에도 로딩 중이면 에러 표시)
    const timeout = setTimeout(() => {
        if (document.getElementById('loading-screen') && !document.getElementById('loading-screen').classList.contains('hidden')) {
            showError("데이터베이스 응답이 너무 늦습니다. 인터넷 연결이나 Firestore 보안 규칙을 확인해 주세요.");
        }
    }, 10000);

    onSnapshot(parkingCol, (snapshot) => {
        clearTimeout(timeout);
        console.log("Data snapshot received. Count:", snapshot.size);
        
        parkingData = { 'B1': {}, 'B2': {}, 'B3': {} };
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (parkingData[data.floor]) {
                parkingData[data.floor][data.spotId] = data;
            }
        });
        renderApp();
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('status-text').innerText = "실시간 보호 중";
    }, (err) => {
        clearTimeout(timeout);
        console.error("Firestore Error:", err);
        showError("데이터베이스 접근 권한이 없습니다. Firestore 보안 규칙을 확인해 주세요. (" + err.code + ")");
    });
}

// GPS 추적
function startGpsTracking() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition((pos) => {
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, TARGET_COORDS.lat, TARGET_COORDS.lng);
        
        // UI 업데이트
        const distText = document.getElementById('distance-text');
        if (distText) distText.innerText = `${Math.round(dist)}m 남음`;
        
        const badge = document.getElementById('distance-badge');
        if (badge) {
            if (dist <= PROXIMITY_RADIUS) {
                badge.innerText = "도착 근접";
                badge.classList.replace('text-gray-400', 'text-green-600');
                badge.classList.replace('bg-gray-50', 'bg-green-50');
                badge.classList.replace('border-gray-200', 'border-green-200');
                document.getElementById('proximity-alert').classList.remove('hidden');
            } else {
                badge.innerText = "위치 추적 중";
                badge.className = "px-2 py-1 rounded-full text-[10px] font-bold border bg-gray-50 text-gray-400 border-gray-200";
            }
        }
    }, (err) => {
        console.warn("GPS Error:", err);
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 렌더링 함수
function renderApp() {
    const grid = document.getElementById('parking-grid');
    const list = document.getElementById('record-list');
    const floorLabel = document.getElementById('floor-indicator');
    
    if (floorLabel) floorLabel.innerText = `${activeFloor} Floor Map`;
    if (grid) grid.innerHTML = '';
    if (list) list.innerHTML = '';

    // 그리드 그리기
    parkingLayout.forEach(spot => {
        const isParked = parkingData[activeFloor][spot.id];
        const btn = document.createElement('button');
        
        let spanClass = "";
        if (spot.type === 'extra-wide') spanClass = "col-span-2";
        if (spot.type === 'tall') spanClass = "row-span-2";

        btn.className = `parking-spot relative rounded-lg border-2 flex items-center justify-center text-[10px] font-bold ${spanClass} ${
            isParked ? 'bg-blue-500 border-blue-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-300'
        }`;
        btn.style.minHeight = spot.type === 'tall' ? '120px' : '60px';
        
        btn.innerHTML = isParked 
            ? `<div class="flex flex-col items-center"><i data-lucide="check-circle-2" class="w-5 h-5 mb-1"></i>My Car</div>`
            : spot.label;
        
        btn.onclick = () => toggleParking(spot.id);
        if (grid) grid.appendChild(btn);
    });

    // 기록 리스트 그리기
    const currentRecords = Object.entries(parkingData[activeFloor]);
    if (list) {
        if (currentRecords.length > 0) {
            currentRecords.forEach(([id, info]) => {
                const item = document.createElement('div');
                item.className = "bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between";
                item.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="bg-blue-50 p-3 rounded-xl"><i data-lucide="clock" class="w-5 h-5 text-blue-600"></i></div>
                        <div>
                            <p class="font-bold text-sm">${activeFloor} 층 - ${id} 구역</p>
                            <p class="text-[11px] text-gray-400">${info.time} 주차</p>
                        </div>
                    </div>
                    <button onclick="window.removeParking('${id}')" class="text-gray-300 hover:text-red-500"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                `;
                list.appendChild(item);
            });
        } else {
            list.innerHTML = `<div class="text-center py-8 text-gray-300 text-xs italic">기록된 차량이 없습니다.</div>`;
        }
    }
    
    lucide.createIcons();
}

// 주차 토글 로직
async function toggleParking(spotId) {
    if (!currentUser) return;
    const isParked = parkingData[activeFloor][spotId];
    const docId = `${activeFloor}_${spotId}`;
    const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'parking', docId);

    try {
        if (isParked) {
            await deleteDoc(docRef);
        } else {
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
            await setDoc(docRef, {
                floor: activeFloor,
                spotId: spotId,
                time: timeStr,
                timestamp: now.getTime()
            });
        }
    } catch (err) {
        console.error("Save Error:", err);
        alert("데이터 저장에 실패했습니다: " + err.message);
    }
}

// 전역 함수 등록
window.switchFloor = (floor) => {
    activeFloor = floor;
    document.querySelectorAll('.floor-tab').forEach(t => {
        t.className = "floor-tab flex-1 py-3 rounded-xl font-bold transition-all bg-gray-100 text-gray-400";
    });
    const activeTab = document.getElementById(`tab-${floor}`);
    if (activeTab) activeTab.className = "floor-tab flex-1 py-3 rounded-xl font-bold transition-all bg-blue-600 text-white shadow-lg shadow-blue-200";
    renderApp();
};

window.removeParking = (id) => toggleParking(id);
window.closeAlert = () => {
    const alert = document.getElementById('proximity-alert');
    if (alert) alert.classList.add('hidden');
};

init();