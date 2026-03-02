import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase 설정 (환경 변수가 없을 경우 대비해 기본 구조 유지)
const firebaseConfig = typeof window.__firebase_config__ === 'string' 
    ? JSON.parse(window.__firebase_config__) 
    : (window.__firebase_config__ || {});
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

// 초기화 함수
async function init() {
    lucide.createIcons();
    
    // 익명 로그인
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            startDataSync();
        } else {
            signInAnonymously(auth);
        }
    });

    startGpsTracking();
}

// 데이터 동기화
function startDataSync() {
    if (!currentUser) return;
    const parkingCol = collection(db, 'artifacts', appId, 'users', currentUser.uid, 'parking');
    
    onSnapshot(parkingCol, (snapshot) => {
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
    });
}

// GPS 추적
function startGpsTracking() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition((pos) => {
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, TARGET_COORDS.lat, TARGET_COORDS.lng);
        
        // UI 업데이트
        document.getElementById('distance-text').innerText = `${Math.round(dist)}m 남음`;
        const badge = document.getElementById('distance-badge');
        
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
    
    floorLabel.innerText = `${activeFloor} Floor Map`;
    grid.innerHTML = '';
    list.innerHTML = '';

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
        grid.appendChild(btn);
    });

    // 기록 리스트 그리기
    const currentRecords = Object.entries(parkingData[activeFloor]);
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
    
    lucide.createIcons();
}

// 주차 토글 로직
async function toggleParking(spotId) {
    if (!currentUser) return;
    const isParked = parkingData[activeFloor][spotId];
    const docId = `${activeFloor}_${spotId}`;
    const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'parking', docId);

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
}

// 전역 함수 등록
window.switchFloor = (floor) => {
    activeFloor = floor;
    document.querySelectorAll('.floor-tab').forEach(t => {
        t.className = "floor-tab flex-1 py-3 rounded-xl font-bold transition-all bg-gray-100 text-gray-400";
    });
    document.getElementById(`tab-${floor}`).className = "floor-tab flex-1 py-3 rounded-xl font-bold transition-all bg-blue-600 text-white shadow-lg shadow-blue-200";
    renderApp();
};

window.removeParking = (id) => toggleParking(id);
window.closeAlert = () => document.getElementById('proximity-alert').classList.add('hidden');

init();