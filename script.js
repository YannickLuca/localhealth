import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const doc = document;
const body = doc.body;

const navToggle = doc.querySelector('[data-toggle-nav]');
const navList = doc.querySelector('[data-nav]');
const navOverlay = doc.querySelector('.nav-overlay');
const navLinks = Array.from(doc.querySelectorAll('.primary-nav .nav-link'));
const locationSelect = doc.getElementById('location');
const autoLocateStoreBtn = doc.getElementById('autoLocateStore');
const manualLocationInput = doc.getElementById('manualLocation');
const manualLocateStoreBtn = doc.getElementById('manualLocateStore');
const storeStatusEl = doc.getElementById('storeStatus');
const storeSuggestionsContainer = doc.getElementById('storeSuggestions');
const storeMapFrame = doc.getElementById('storeMapFrame');
const defaultMapCoords = { lat: 47.3310, lon: 8.6200 };
const defaultStoreStatusMessage =
  storeStatusEl?.textContent?.trim() ||
  'Optional: Erlaube den Standortzugriff oder gib PLZ/Adresse ein, damit wir den naechstgelegenen Laden vorschlagen und die Top 3-5 anzeigen koennen.';

const cookiePreferenceKey = 'localhealth-cookie-preference';
const cookieBanner = doc.getElementById('cookieBanner');
const acceptCookiesBtn = doc.getElementById('acceptCookies');
const declineCookiesBtn = doc.getElementById('declineCookies');

const authModal = doc.getElementById('authModal');
const authCloseTrigger = doc.querySelector('[data-close-auth]');
const authTabs = Array.from(doc.querySelectorAll('[data-auth-tab]'));
const authTitle = doc.getElementById('authTitle');
const authSubtitle = doc.getElementById('authSubtitle');
const authStatus = doc.getElementById('authStatus');
const loginForm = doc.getElementById('loginForm');
const registerForm = doc.getElementById('registerForm');
const authTriggerButtons = Array.from(doc.querySelectorAll('[data-open-auth]'));
const logoutButton = doc.getElementById('logoutBtn');

const authMessages = {
  login: 'Melde dich an oder nutze deine Beta-Zugangsdaten.',
  register: 'Erstelle ein Konto und sichere dir den Zugang zur Beta.'
};

const authTitles = {
  login: 'Willkommen zur&uuml;ck',
  register: 'Account erstellen'
};

let activeAuthMode = 'login';

function openNav() {
  if (!navList) {
    return;
  }
  navList.classList.add('is-open');
  body.classList.add('nav-open');
  navOverlay?.classList.add('is-visible');
  if (navToggle) {
    navToggle.setAttribute('aria-expanded', 'true');
  }
}

function closeNav() {
  if (!navList) {
    return;
  }
  navList.classList.remove('is-open');
  body.classList.remove('nav-open');
  navOverlay?.classList.remove('is-visible');
  if (navToggle) {
    navToggle.setAttribute('aria-expanded', 'false');
  }
}

navToggle?.addEventListener('click', () => {
  if (navList?.classList.contains('is-open')) {
    closeNav();
  } else {
    openNav();
  }
});

navOverlay?.addEventListener('click', closeNav);
navLinks.forEach(link => {
  link.addEventListener('click', closeNav);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    closeNav();
  }
});

function setCookiePreference(value) {
  try {
    localStorage.setItem(
      cookiePreferenceKey,
      JSON.stringify({ value, timestamp: Date.now() })
    );
  } catch (error) {
    console.warn('Konnte Cookie-Pr&auml;ferenz nicht speichern.', error);
  }
  doc.documentElement.setAttribute('data-cookie-consent', value);
  if (cookieBanner) {
    cookieBanner.classList.remove('is-visible');
    cookieBanner.setAttribute('aria-hidden', 'true');
  }
}

function initCookieBanner() {
  if (!cookieBanner) {
    return;
  }
  try {
    const stored = localStorage.getItem(cookiePreferenceKey);
    if (!stored) {
      cookieBanner.classList.add('is-visible');
      cookieBanner.setAttribute('aria-hidden', 'false');
      return;
    }
    const parsed = JSON.parse(stored);
    if (parsed?.value) {
      doc.documentElement.setAttribute('data-cookie-consent', parsed.value);
    }
  } catch (error) {
    console.warn('Cookie-Banner konnte nicht initialisiert werden.', error);
    cookieBanner.classList.add('is-visible');
    cookieBanner.setAttribute('aria-hidden', 'false');
  }
}

acceptCookiesBtn?.addEventListener('click', () => setCookiePreference('accepted'));
declineCookiesBtn?.addEventListener('click', () => setCookiePreference('declined'));

function updateAuthStatus(message = '', isError = false) {
  if (!authStatus) {
    return;
  }
  authStatus.textContent = message;
  authStatus.classList.remove('is-error');
  authStatus.style.display = message ? 'block' : 'none';
  if (message && isError) {
    authStatus.classList.add('is-error');
  }
}

function setAuthTriggersHidden(hidden) {
  authTriggerButtons.forEach(btn => {
    if (hidden) {
      btn.setAttribute('hidden', 'true');
    } else {
      btn.removeAttribute('hidden');
    }
  });
}

function setActiveTab(mode = 'login') {
  activeAuthMode = mode;
  authTabs.forEach(tab => {
    const isActive = tab.dataset.authTab === mode;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  if (loginForm instanceof HTMLElement) {
    loginForm.classList.toggle('is-hidden', mode !== 'login');
  }
  if (registerForm instanceof HTMLElement) {
    registerForm.classList.toggle('is-hidden', mode !== 'register');
  }
  if (authTitle) {
    authTitle.innerHTML = authTitles[mode] ?? 'LocalHealth';
  }
  if (authSubtitle) {
    authSubtitle.innerHTML = authMessages[mode] ?? '';
  }
  updateAuthStatus('');
}

function openAuth(mode = 'login') {
  setActiveTab(mode);
  if (!authModal) {
    return;
  }
  authModal.classList.add('is-visible');
  authModal.setAttribute('aria-hidden', 'false');
  body.classList.add('modal-open');
  const targetForm = mode === 'login' ? loginForm : registerForm;
  const firstInput = targetForm?.querySelector('input');
  if (firstInput instanceof HTMLElement) {
    requestAnimationFrame(() => firstInput.focus());
  }
}

function closeAuth() {
  if (!authModal) {
    return;
  }
  authModal.classList.remove('is-visible');
  authModal.setAttribute('aria-hidden', 'true');
  body.classList.remove('modal-open');
  updateAuthStatus('');
}

authTriggerButtons.forEach(btn => {
  btn.addEventListener('click', event => {
    event.preventDefault();
    const mode = btn.getAttribute('data-open-auth') ?? 'login';
    openAuth(mode);
  });
});

authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.authTab ?? 'login';
    setActiveTab(mode);
  });
});

authCloseTrigger?.addEventListener('click', closeAuth);

authModal?.addEventListener('click', event => {
  if (event.target === authModal) {
    closeAuth();
  }
});

setAuthTriggersHidden(false);
setActiveTab(activeAuthMode);
updateAuthStatus('');

doc.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeNav();
    closeAuth();
  }
});

const firebaseConfig = {
  apiKey: "AIzaSyAkBIeUB8_zIelhGero_9O4jSKBStXtIWE",
  authDomain: "localhealth-bd53d.firebaseapp.com",
  projectId: "localhealth-bd53d",
  storageBucket: "localhealth-bd53d.firebasestorage.app",
  messagingSenderId: "576165586467",
  appId: "1:576165586467:web:75c419e69e55bfc4033396",
  measurementId: "G-WQB61Q5MB7"
};

let firebaseApp;
let auth;
let db;

try {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
} catch (error) {
  console.warn('Firebase konnte nicht initialisiert werden.', error);
}

if (loginForm) {
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!auth) {
      updateAuthStatus('Login ist aktuell offline verf&uuml;gbar.', true);
      return;
    }
    /** @type {HTMLInputElement|null} */
    const emailInput = loginForm.querySelector('#loginEmail');
    /** @type {HTMLInputElement|null} */
    const passInput = loginForm.querySelector('#loginPass');
    if (!emailInput || !passInput) {
      return;
    }
    const email = emailInput.value.trim();
    const pass = passInput.value;
    if (!email || !pass) {
      updateAuthStatus('Bitte E-Mail und Passwort eingeben.', true);
      return;
    }
    updateAuthStatus('Login wird ausgef&uuml;hrt ...');
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      closeAuth();
    } catch (error) {
      updateAuthStatus(mapFirebaseError(error), true);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!auth) {
      updateAuthStatus('Registrierung ist aktuell offline verf&uuml;gbar.', true);
      return;
    }
    /** @type {HTMLInputElement|null} */
    const emailInput = registerForm.querySelector('#regEmail');
    /** @type {HTMLInputElement|null} */
    const passInput = registerForm.querySelector('#regPass');
    if (!emailInput || !passInput) {
      return;
    }
    const email = emailInput.value.trim();
    const pass = passInput.value;
    if (!email || !pass) {
      updateAuthStatus('Bitte E-Mail und Passwort eingeben.', true);
      return;
    }
    updateAuthStatus('Account wird erstellt ...');
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      if (db) {
        try {
          await addDoc(collection(db, 'registrations'), {
            uid: credential.user?.uid ?? null,
            email,
            createdAt: serverTimestamp()
          });
        } catch (storeError) {
          console.warn('Registrierung konnte nicht gespeichert werden.', storeError);
        }
      }
      updateAuthStatus('Registrierung erfolgreich! Du kannst dich jetzt einloggen.');
      setActiveTab('login');
      const loginEmailInput = loginForm?.querySelector('#loginEmail');
      if (loginEmailInput instanceof HTMLElement) {
        loginEmailInput.focus();
      }
    } catch (error) {
      updateAuthStatus(mapFirebaseError(error), true);
    }
  });
}

logoutButton?.addEventListener('click', async () => {
  if (!auth) {
    return;
  }
  try {
    await signOut(auth);
  } catch (error) {
    updateAuthStatus('Logout nicht m&ouml;glich. Bitte versuche es erneut.', true);
  }
});

if (auth) {
  onAuthStateChanged(auth, user => {
    if (user) {
      setAuthTriggersHidden(true);
      logoutButton?.removeAttribute('hidden');
      updateAuthStatus('');
      closeAuth();
    } else {
      setAuthTriggersHidden(false);
      logoutButton?.setAttribute('hidden', 'true');
    }
  });
} else {
  logoutButton?.setAttribute('hidden', 'true');
}

function mapFirebaseError(error) {
  const code = error && typeof error === 'object' ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Diese E-Mail wird bereits verwendet.';
    case 'auth/invalid-email':
      return 'Bitte gib eine g&uuml;ltige E-Mail-Adresse ein.';
    case 'auth/weak-password':
      return 'Bitte w&auml;hle ein st&auml;rkeres Passwort (mind. 6 Zeichen).';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-Mail oder Passwort ist nicht korrekt.';
    default:
      return error?.message ?? 'Unbekannter Fehler. Bitte versuche es erneut.';
  }
}

const goalLabels = {
  balanced: 'Balance & Alltag',
  'lean-mass': 'Lean Mass Aufbau',
  hypertrophy: 'Hypertrophy',
  fatloss: 'Body Recomposition',
  endurance: 'Ausdauer',
  power: 'Power & HIIT'
};

const seasonLabels = {
  fruehling: 'Fr&uuml;hling',
  sommer: 'Sommer',
  herbst: 'Herbst',
  winter: 'Winter'
};

const storeLocations = [
  { id: 'coop-zumikon', chain: 'coop', name: 'Coop Supermarkt Zumikon', lat: 47.3319, lon: 8.6199 },
  { id: 'coop-bellevue', chain: 'coop', name: 'Coop City Bellevue Zuerich', lat: 47.3671, lon: 8.5451 },
  { id: 'coop-uster', chain: 'coop', name: 'Coop Supermarkt Uster', lat: 47.3484, lon: 8.7207 },
  { id: 'migros-zumikon', chain: 'migros', name: 'Migros Supermarkt Zumikon', lat: 47.3304, lon: 8.6184 },
  { id: 'migros-stadelhofen', chain: 'migros', name: 'Migros Stadelhofen Zuerich', lat: 47.3668, lon: 8.5489 },
  { id: 'migros-meilen', chain: 'migros', name: 'Migros Meilen', lat: 47.2705, lon: 8.6458 },
  { id: 'migros-winterthur', chain: 'migros', name: 'Migros Winterthur Bahnhof', lat: 47.4996, lon: 8.7249 },
  { id: 'aldi-duebendorf', chain: 'aldi', name: 'Aldi Suisse Duebendorf', lat: 47.3982, lon: 8.6188 },
  { id: 'aldi-selnau', chain: 'aldi', name: 'Aldi Suisse Selnau Zuerich', lat: 47.3694, lon: 8.5341 },
  { id: 'aldi-uster', chain: 'aldi', name: 'Aldi Suisse Uster', lat: 47.3509, lon: 8.7188 },
  { id: 'spar-zumikon', chain: 'spar', name: 'Spar Express Zumikon', lat: 47.3311, lon: 8.6221 },
  { id: 'spar-bellevue', chain: 'spar', name: 'Spar City Bellevue Zuerich', lat: 47.3689, lon: 8.5457 },
  { id: 'denner-kuesnacht', chain: 'denner', name: 'Denner Satellit Kuesnacht', lat: 47.3179, lon: 8.5851 },
  { id: 'denner-europaallee', chain: 'denner', name: 'Denner Europaallee Zuerich', lat: 47.3760, lon: 8.5350 },
  { id: 'denner-winterthur', chain: 'denner', name: 'Denner Winterthur Bahnhofplatz', lat: 47.4985, lon: 8.7265 },
  { id: 'market-zumikon', chain: 'farmers-market', name: 'Wochenmarkt Zumikon Dorfplatz', lat: 47.3310, lon: 8.6200 },
  { id: 'market-helvetiaplatz', chain: 'farmers-market', name: 'Wochenmarkt Helvetiaplatz Zuerich', lat: 47.3726, lon: 8.5253 },
  { id: 'market-uster', chain: 'farmers-market', name: 'Wochenmarkt Uster Stadthof', lat: 47.3478, lon: 8.7189 }
];

const knownLocations = [
  {
    label: 'Zumikon (8126)',
    labelHtml: 'Zumikon (8126)',
    lat: 47.3310,
    lon: 8.6220,
    matchers: [
      ['zumikon'],
      ['8126'],
      ['zumikon', '8126']
    ]
  },
  {
    label: 'Wiesenstrasse 12, 8126 Zumikon',
    labelHtml: 'Wiesenstrasse 12, 8126 Zumikon',
    lat: 47.3315,
    lon: 8.6215,
    matchers: [
      ['wiesenstrasse', '8126'],
      ['wiesenstrasse', 'zumikon'],
      ['wiesenstrasse', '12', '8126'],
      ['wiesenstrasse12']
    ]
  },
  {
    label: 'Zuerich Zentrum (8001)',
    labelHtml: 'Z&uuml;rich Zentrum (8001)',
    lat: 47.3717,
    lon: 8.5420,
    matchers: [
      ['zuerich'],
      ['zurich'],
      ['8001'],
      ['zuerich', '8001']
    ]
  },
  {
    label: 'Bahnhofstrasse 1, 8001 Zuerich',
    labelHtml: 'Bahnhofstrasse 1, 8001 Z&uuml;rich',
    lat: 47.3717,
    lon: 8.5398,
    matchers: [
      ['bahnhofstrasse', '1', 'zuerich'],
      ['bahnhofstrasse', '1', 'zurich'],
      ['bahnhofstrasse', '8001'],
      ['bahnhofstrasse1']
    ]
  },
  {
    label: 'Duebendorf (8600)',
    labelHtml: 'D&uuml;bendorf (8600)',
    lat: 47.3981,
    lon: 8.6187,
    matchers: [
      ['duebendorf'],
      ['8600'],
      ['duebendorf', '8600']
    ]
  },
  {
    label: 'Uster (8610)',
    labelHtml: 'Uster (8610)',
    lat: 47.3468,
    lon: 8.7204,
    matchers: [
      ['uster'],
      ['8610'],
      ['uster', '8610']
    ]
  },
  {
    label: 'Meilen (8706)',
    labelHtml: 'Meilen (8706)',
    lat: 47.2700,
    lon: 8.6460,
    matchers: [
      ['meilen'],
      ['8706']
    ]
  },
  {
    label: 'Winterthur (8400)',
    labelHtml: 'Winterthur (8400)',
    lat: 47.4988,
    lon: 8.7241,
    matchers: [
      ['winterthur'],
      ['8400']
    ]
  },
  {
    label: 'Kuesnacht (8700)',
    labelHtml: 'K&uuml;snacht (8700)',
    lat: 47.3185,
    lon: 8.5843,
    matchers: [
      ['kuesnacht'],
      ['8700'],
      ['kuesnacht', '8700']
    ]
  },
  {
    label: 'Bahnhofstrasse 24, 8700 Kuesnacht',
    labelHtml: 'Bahnhofstrasse 24, 8700 K&uuml;snacht',
    lat: 47.3182,
    lon: 8.5826,
    matchers: [
      ['bahnhofstrasse', '24', 'kuesnacht'],
      ['bahnhofstrasse', '8700'],
      ['bahnhofstrasse24']
    ]
  },
  {
    label: 'Staefa (8712)',
    labelHtml: 'St&auml;fa (8712)',
    lat: 47.2427,
    lon: 8.7236,
    matchers: [
      ['stafa'],
      ['staefa'],
      ['8712']
    ]
  }
];

const supportedLocationsText = knownLocations.map(loc => loc.label).join(', ');

let lastSuggestedStore = null;
let locatingStore = false;
let recentStoreSuggestions = [];
let lastOriginCoords = { ...defaultMapCoords, label: 'LocalHealth' };

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function calculateDistanceInKm(from, to) {
  if (
    !from ||
    !to ||
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lon) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lon)
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return '';
  }
  if (distanceKm < 1) {
    const meters = Math.max(100, Math.round(distanceKm * 1000));
    return `${meters} m`;
  }
  const precision = distanceKm < 10 ? 1 : 0;
  return `${distanceKm.toFixed(precision)} km`;
}

function getNearestStores(coords, limit = 5) {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) {
    return [];
  }
  const candidates = [];
  for (const store of storeLocations) {
    const distanceKm = calculateDistanceInKm(coords, store);
    if (!Number.isFinite(distanceKm)) {
      continue;
    }
    candidates.push({
      ...store,
      distanceKm,
      distanceText: formatDistance(distanceKm)
    });
  }
  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  return candidates.slice(0, limit);
}

function findNearestStore(coords) {
  const [first] = getNearestStores(coords, 1);
  return first || null;
}

function normalizeLocationQuery(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\u00E4/g, 'ae')
    .replace(/\u00F6/g, 'oe')
    .replace(/\u00FC/g, 'ue')
    .replace(/\u00DF/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

function tokenizeLocationInput(value) {
  return value
    .split(/[\s,;]+/)
    .map(part => normalizeLocationQuery(part))
    .filter(Boolean);
}

function findKnownLocation(value) {
  if (!value) {
    return null;
  }
  const tokens = tokenizeLocationInput(value);
  if (!tokens.length) {
    return null;
  }
  const tokenSet = new Set(tokens);
  const joinedTokens = tokens.join('');
  return (
    knownLocations.find(location => {
      if (location.matchers?.length) {
        return location.matchers.some(matcher =>
          matcher.every(token => tokenSet.has(token))
        );
      }
      if (location.tokens?.length) {
        return location.tokens.some(token => joinedTokens.includes(token));
      }
      return false;
    }) || null
  );
}

function clearStoreSuggestions() {
  if (!storeSuggestionsContainer) {
    return;
  }
  storeSuggestionsContainer.innerHTML = '';
  storeSuggestionsContainer.classList.remove('is-visible');
  recentStoreSuggestions = [];
  lastOriginCoords = { ...defaultMapCoords, label: 'LocalHealth' };
  updateStoreMap(lastOriginCoords, []);
}

function presentStoreSuggestions(originCoords, labelHtml) {
  if (!storeSuggestionsContainer) {
    return [];
  }
  const origin = {
    lat: Number(originCoords?.lat),
    lon: Number(originCoords?.lon)
  };
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lon)) {
    clearStoreSuggestions();
    return [];
  }
  const sanitizedLabel = labelHtml
    ? labelHtml.replace(/<[^>]+>/g, '').trim() || 'Startpunkt'
    : 'Startpunkt';
  origin.label = sanitizedLabel;
  lastOriginCoords = origin;
  const nearest = getNearestStores(origin, 5);
  if (!nearest.length) {
    clearStoreSuggestions();
    return [];
  }
  const heading = labelHtml
    ? `Naechste Laeden ab ${labelHtml}`
    : 'Naechste Laeden in deiner Naehe';
  const listHtml = nearest
    .map(
      store => `
        <button class="store-suggestion-item" type="button" data-store-id="${store.id}" data-chain="${store.chain}">
          <span class="store-suggestion-name">${store.name}</span>
          <span class="store-suggestion-distance">${store.distanceText}</span>
        </button>
      `
    )
    .join('');
  storeSuggestionsContainer.innerHTML = `
    <p class="store-suggestion-heading">${heading}</p>
    <div class="store-suggestion-list">${listHtml}</div>
  `;
  storeSuggestionsContainer.classList.add('is-visible');
  updateStoreSuggestionHighlight(null);
  recentStoreSuggestions = nearest;
  updateStoreMap(origin, nearest);
  return nearest;
}

function updateStoreSuggestionHighlight(activeId) {
  if (!storeSuggestionsContainer) {
    return;
  }
  const buttons = storeSuggestionsContainer.querySelectorAll('[data-store-id]');
  buttons.forEach(button => {
    const isActive = activeId && button.getAttribute('data-store-id') === activeId;
    button.classList.toggle('is-active', Boolean(isActive));
  });
}

function applyStoreSelection(store) {
  if (!store) {
    return;
  }
  const distanceSegment = store.distanceText ? ` (${store.distanceText} entfernt)` : '';
  const message = `Empfehlung: ${store.name}${distanceSegment}`;
  lastSuggestedStore = { ...store, message };
  setStoreStatus(message, 'success');
  if (locationSelect instanceof HTMLSelectElement) {
    locationSelect.value = store.chain;
    locationSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  updateStoreSuggestionHighlight(store.id);
  updateStoreMap(lastOriginCoords, recentStoreSuggestions, store.id);
}

function updateStoreMap(origin = defaultMapCoords, stores = [], activeStoreId = null) {
  if (!storeMapFrame) {
    return;
  }
  const points = [];
  const originLat = Number(origin?.lat);
  const originLon = Number(origin?.lon);
  if (Number.isFinite(originLat) && Number.isFinite(originLon)) {
    points.push({
      lat: originLat,
      lon: originLon,
      label: origin?.label || 'Startpunkt'
    });
  }
  for (const store of stores) {
    const lat = Number(store?.lat);
    const lon = Number(store?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    const highlight = store.id === activeStoreId ? 'TOP ' : '';
    points.push({
      lat,
      lon,
      label: `${highlight}${store.name}`
    });
  }
  if (!points.length) {
    const fallback = `${defaultMapCoords.lat},${defaultMapCoords.lon}`;
    storeMapFrame.src = `https://www.google.com/maps?q=${fallback}&z=12&output=embed`;
    return;
  }
  const zoomLevel = points.length >= 4 ? 12 : 13;
  const query = points
    .map(point => {
      const coordsLabel = `${point.lat.toFixed(5)},${point.lon.toFixed(5)} (${point.label})`;
      return `q=${encodeURIComponent(coordsLabel)}`;
    })
    .join('&');
  storeMapFrame.src = `https://www.google.com/maps?${query}&z=${zoomLevel}&output=embed`;
}

function getGeolocationErrorMessage(error) {
  switch (error?.code) {
    case 1:
      return 'Bitte erlaube den Standortzugriff, um Laeden in deiner Naehe zu finden.';
    case 2:
      return 'Deine Position konnte nicht ermittelt werden. Bitte aktiviere GPS oder versuche es erneut.';
    case 3:
      return 'Die Standortsuche hat zu lange gedauert. Versuche es bitte erneut.';
    default:
      return 'Standort konnte aktuell nicht ermittelt werden.';
  }
}

function setStoreStatus(message = defaultStoreStatusMessage, variant = 'info') {
  if (!storeStatusEl) {
    return;
  }
  const text = message || defaultStoreStatusMessage;
  storeStatusEl.textContent = text;
  storeStatusEl.classList.remove('is-error', 'is-success', 'is-pending');
  if (variant === 'error') {
    storeStatusEl.classList.add('is-error');
  } else if (variant === 'success') {
    storeStatusEl.classList.add('is-success');
  } else if (variant === 'pending') {
    storeStatusEl.classList.add('is-pending');
  }
}

setStoreStatus(defaultStoreStatusMessage, 'info');
lastOriginCoords = { ...defaultMapCoords, label: 'LocalHealth' };
updateStoreMap(lastOriginCoords, []);
let mealDataset = [
  {
    id: 'fruehling-balanced-1',
    season: 'fruehling',
    goal: 'balanced',
    diet: ['omnivore', 'vegetarian', 'pescetarian', 'vegan'],
    name: 'Spargel-Quinoa Bowl',
    description: 'Ger&ouml;steter Gr&uuml;nspargel, Quinoa, Babyspinat und Zitronen-Tahini-Dressing.',
    carbon: 1.8,
    macros: { kcal: 520, protein: 26, carbs: 62, fat: 17 },
    tags: ['Meal-Prep 2 Tage', 'Omega-3 aus Leinsamen'],
    shopNotes: {
      coop: 'Coop Naturaline Spargel aus dem Thurgau.',
      migros: 'Migros Bio-Quinoa aus Graub&uuml;nden.',
      aldi: 'Aldi Suisse saisonale Kichererbsen im Glas.',
      'farmers-market': 'Direkt vom Wochenmarkt Z&uuml;rich Helvetiaplatz.'
    },
    co2Source: 'Ecoinvent: Vegetables, asparagus, CH, 2024'
  },
  {
    id: 'fruehling-muscle-1',
    season: 'fruehling',
    goal: 'muscle',
    diet: ['omnivore', 'vegetarian', 'pescetarian'],
    name: 'Beluga-Kernotto mit B&auml;rlauch-Pesto',
    description: 'Belugalinsen, Gerstenkernotto und B&auml;rlauch-Pesto mit Bio-Ei als Protein-Boost.',
    carbon: 2.3,
    macros: { kcal: 620, protein: 32, carbs: 68, fat: 18 },
    tags: ['Proteinreich', 'Eisen &amp; Zink'],
    shopNotes: {
      coop: 'Coop Karma Bio-Eier und Belugalinsen.',
      migros: 'Migros Alnatura B&auml;rlauch f&uuml;r frisches Pesto.',
      spar: 'Spar Regional Eier aus Freilandhaltung.'
    },
    co2Source: 'Ecoinvent: Lentils, dried, CH, 2024'
  },
  {
    id: 'fruehling-weightloss-1',
    season: 'fruehling',
    goal: 'weightloss',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Radiesli-Fenchelsalat mit Apfel',
    description: 'Knackiger Salat aus Radiesli, Fenchel, Apfel und Hanfsamen-Dressing.',
    carbon: 1.4,
    macros: { kcal: 340, protein: 18, carbs: 42, fat: 12 },
    tags: ['Ballaststoffreich', 'Vitamin C Boost'],
    shopNotes: {
      migros: 'Migros Saisonradiesli &amp; Fenchel aus der Region.',
      denner: 'Denner Bio-Apfel f&uuml;r s&uuml;&szlig;e Noten.',
      'farmers-market': 'Lokale Produzenten in Zumikon am Samstag.'
    },
    co2Source: 'Ecoinvent: Root vegetables, mixed, CH, 2024'
  },
  {
    id: 'fruehling-endurance-1',
    season: 'fruehling',
    goal: 'endurance',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Fr&uuml;hlings-Minestrone',
    description: 'Saisonale Minestrone mit Pastinaken, Erbsen und Vollkorn-Pasta.',
    carbon: 1.9,
    macros: { kcal: 480, protein: 24, carbs: 64, fat: 14 },
    tags: ['Regeneration', 'Komplexe Kohlenhydrate'],
    shopNotes: {
      coop: 'Coop Naturaplan Vollkornpasta aus der Schweiz.',
      migros: 'Migros Bio-Erbsen tiefgek&uuml;hlt.',
      aldi: 'Aldi Suisse Pastinaken aus Vertragslandwirtschaft.'
    },
    co2Source: 'Ecoinvent: Vegetable soup, CH, 2024'
  },
  {
    id: 'sommer-balanced-1',
    season: 'sommer',
    goal: 'balanced',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Tomaten-Pfirsich Panzanella',
    description: 'Sommersalat mit Tomaten, Pfirsich, Vollkornbrot und Basilikum-Vinaigrette.',
    carbon: 1.6,
    macros: { kcal: 560, protein: 22, carbs: 70, fat: 18 },
    tags: ['Antioxidantien', 'Hydration'],
    shopNotes: {
      migros: 'Migros Genuss K&ouml;rbchen Pfirsiche aus dem Wallis.',
      coop: 'Coop Slow Bread Vollkorn-Brot vom Vortag nutzen.',
      spar: 'Spar Basilikum im Topf f&uuml;r lange Frische.'
    },
    co2Source: 'Ecoinvent: Tomatoes, open field, CH, 2024'
  },
  {
    id: 'sommer-muscle-1',
    season: 'sommer',
    goal: 'muscle',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Hanf-Protein Wraps',
    description: 'Vollkornwraps mit schwarzen Bohnen, Hanfsamen und Mais-Paprika-Salsa.',
    carbon: 1.9,
    macros: { kcal: 610, protein: 36, carbs: 66, fat: 20 },
    tags: ['Pflanzliches Protein', 'Magnesium'],
    shopNotes: {
      coop: 'Coop Karma Hanfsamen f&uuml;r die Proteinquelle.',
      denner: 'Denner Schweizer Bohnen aus der Dose.',
      'farmers-market': 'Maiskolben frisch vom Bauernhof grillen.'
    },
    co2Source: 'Ecoinvent: Beans, black, organic, CH, 2024'
  },
  {
    id: 'sommer-weightloss-1',
    season: 'sommer',
    goal: 'weightloss',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Zucchetti-Noodle Bowl',
    description: 'Zucchetti-Spiralen mit Kirschtomaten, Rucola und Limetten-Mandel-Sauce.',
    carbon: 1.2,
    macros: { kcal: 310, protein: 16, carbs: 30, fat: 12 },
    tags: ['Low Carb', 'Entz&uuml;ndungshemmend'],
    shopNotes: {
      migros: 'Migros Daily vegi Zucchetti vor-spiralisiert.',
      coop: 'Coop Rucola aus Bio-Indoor-Farming.',
      aldi: 'Aldi Suisse Mandeln f&uuml;r die Sauce.'
    },
    co2Source: 'Ecoinvent: Courgette, CH, 2024'
  },
  {
    id: 'sommer-endurance-1',
    season: 'sommer',
    goal: 'endurance',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Gersten-Gazpacho',
    description: 'Gek&uuml;hlte Tomaten-Gazpacho mit Schweizer Rollgerste und Minze.',
    carbon: 1.7,
    macros: { kcal: 540, protein: 28, carbs: 72, fat: 15 },
    tags: ['Elektrolyte', 'Meal-Prep f&uuml;r hei&szlig;e Tage'],
    shopNotes: {
      coop: 'Coop Naturaplan Rollgerste f&uuml;r Schweizer Ursprung.',
      migros: 'Migros Bio-Minze frische Bundware.',
      spar: 'Spar Tomaten in Sommeraktion.'
    },
    co2Source: 'Ecoinvent: Soup, vegetable, chilled, CH, 2024'
  },
  {
    id: 'herbst-balanced-1',
    season: 'herbst',
    goal: 'balanced',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'K&uuml;rbis-Dinkel Bowl',
    description: 'Ofenk&uuml;rbis mit Dinkel, Federkohl und Haselnuss-Salsa.',
    carbon: 2.1,
    macros: { kcal: 550, protein: 24, carbs: 70, fat: 16 },
    tags: ['Beta-Carotin', 'Saison Herbst'],
    shopNotes: {
      coop: 'Coop Pumpkins aus Schweizer Freilandproduktion.',
      migros: 'Migros UrDinkel f&uuml;r komplexe Kohlenhydrate.',
      denner: 'Denner Haseln&uuml;sse aus dem Tessin.'
    },
    co2Source: 'Ecoinvent: Pumpkin, CH, 2024'
  },
  {
    id: 'herbst-muscle-1',
    season: 'herbst',
    goal: 'muscle',
    diet: ['omnivore', 'vegetarian', 'pescetarian'],
    name: 'Pilz-Polenta Bake',
    description: 'Cremige Polenta mit Steinpilzen, Sbrinz und Traubenkern&ouml;l.',
    carbon: 2.4,
    macros: { kcal: 640, protein: 34, carbs: 62, fat: 22 },
    tags: ['Recovery', 'Kalziumquelle'],
    shopNotes: {
      spar: 'Spar Schweizer Steinpilze (getrocknet) im Herbstsortiment.',
      coop: 'Coop Sbrinz AOP f&uuml;r intensiven Geschmack.',
      migros: 'Migros Traubenkern&ouml;l aus der Region.'
    },
    co2Source: 'Ecoinvent: Cheese, hard, CH, 2024'
  },
  {
    id: 'herbst-weightloss-1',
    season: 'herbst',
    goal: 'weightloss',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Rotkraut-Apfel Slaw',
    description: 'Rotkraut, Apfel, Cranberries und ger&ouml;stete K&uuml;rbiskerne mit Apfelessig-Dressing.',
    carbon: 1.5,
    macros: { kcal: 320, protein: 14, carbs: 38, fat: 12 },
    tags: ['Vitamin K', 'Immun Boost'],
    shopNotes: {
      migros: 'Migros Bio-Rotkraut und Winter&auml;pfel.',
      denner: 'Denner Cranberries unges&uuml;&szlig;t.',
      'farmers-market': 'K&uuml;rbiskerne direkt vom Hof.'
    },
    co2Source: 'Ecoinvent: Cabbage, red, CH, 2024'
  },
  {
    id: 'herbst-endurance-1',
    season: 'herbst',
    goal: 'endurance',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Beluga Trauben Tabbouleh',
    description: 'Belugalinsen, Petersilie, Trauben und Zitronen-Dressing mit Waln&uuml;ssen.',
    carbon: 2.0,
    macros: { kcal: 560, protein: 30, carbs: 74, fat: 14 },
    tags: ['Langzeit-Energie', 'Polyphenole'],
    shopNotes: {
      coop: 'Coop Trauben aus dem Wallis.',
      migros: 'Migros Bio-Belugalinsen im Angebot.',
      aldi: 'Aldi Suisse Waln&uuml;sse aus Graub&uuml;nden.'
    },
    co2Source: 'Ecoinvent: Lentils, dried, CH, 2024'
  },
  {
    id: 'winter-balanced-1',
    season: 'winter',
    goal: 'balanced',
    diet: ['vegetarian', 'pescetarian', 'omnivore'],
    name: 'Rosenkohl Traybake',
    description: 'Rosenkohl, Pastinaken und Birnen auf einem Blech, serviert mit H&uuml;ttenk&auml;se-Dip.',
    carbon: 2.6,
    macros: { kcal: 520, protein: 24, carbs: 58, fat: 18 },
    tags: ['Vitamin C', 'Meal-Prep 3 Tage'],
    shopNotes: {
      coop: 'Coop Naturaplan Rosenkohl aus dem Seeland.',
      migros: 'Migros Pastinaken aus regionalem Anbau.',
      denner: 'Denner Schweizer Frischk&auml;se als leichte Alternative.'
    },
    co2Source: 'Ecoinvent: Sprouts, Brussels, CH, 2024'
  },
  {
    id: 'winter-muscle-1',
    season: 'winter',
    goal: 'muscle',
    diet: ['vegetarian', 'pescetarian', 'omnivore'],
    name: 'Linsen-Sp&auml;tzli mit Sbrinz',
    description: 'Hausgemachte Vollkorn-Sp&auml;tzli mit Linsenragout, Karotten und Sbrinz-Dressing.',
    carbon: 2.8,
    macros: { kcal: 690, protein: 36, carbs: 70, fat: 24 },
    tags: ['High Protein', 'Winter Comfort'],
    shopNotes: {
      migros: 'Migros Vollkorn-Sp&auml;tzli Teig aus der Frischetheke.',
      coop: 'Coop Linsenmix f&uuml;r schnelle Zubereitung.',
      spar: 'Spar Sbrinz AOP in der K&auml;setheke.'
    },
    co2Source: 'Ecoinvent: Pasta, wholegrain, CH, 2024'
  },
  {
    id: 'winter-weightloss-1',
    season: 'winter',
    goal: 'weightloss',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Sellerie-Apfel Suppe',
    description: 'Cremige Suppe aus Sellerie, Apfel, Lauch und Hafermilch, getoppt mit Randenchips.',
    carbon: 1.9,
    macros: { kcal: 290, protein: 10, carbs: 36, fat: 9 },
    tags: ['W&auml;rmend', 'Ballaststoffreich'],
    shopNotes: {
      coop: 'Coop Lauch &amp; Sellerie aus dem Schweizer Mittelland.',
      migros: 'Migros Alnatura Haferdrink.',
      denner: 'Denner Randen vorgegart f&uuml;r knusprige Chips.'
    },
    co2Source: 'Ecoinvent: Soup, vegetable, CH, 2024'
  },
  {
    id: 'winter-endurance-1',
    season: 'winter',
    goal: 'endurance',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Hirse-Sanddorn Porridge',
    description: 'Warmer Hirsebrei mit Sanddornp&uuml;ree, Birne und ger&ouml;steten Haseln&uuml;ssen.',
    carbon: 2.5,
    macros: { kcal: 610, protein: 22, carbs: 82, fat: 18 },
    tags: ['Immunstark', 'Schnelle Energie'],
    shopNotes: {
      migros: 'Migros Bio-Hirse &amp; Sanddornp&uuml;ree aus dem Tiefk&uuml;hlregal.',
      coop: 'Coop Haseln&uuml;sse aus dem Wallis.',
      'farmers-market': 'Birnen direkt vom Hofladen in Zumikon.'
    },
    co2Source: 'Ecoinvent: Millet, hulled, CH, 2024'
  }
];

// Overwrite dataset with erweiterten Vorschl&auml;gen inklusive Preisen und Produktplatzhaltern
mealDataset = [
  {
    id: 'fruehling-balanced-1',
    season: 'fruehling',
    goal: 'balanced',
    diet: ['omnivore', 'vegetarian', 'pescetarian', 'vegan'],
    name: 'Spargel-Quinoa Bowl',
    description: 'Ger&ouml;steter Gr&uuml;nspargel, Quinoa, Babyspinat und Zitronen-Tahini-Dressing.',
    carbon: 1.6,
    macros: { kcal: 520, protein: 26, carbs: 62, fat: 17 },
    pricePerPortion: 8.5,
    products: [
      { name: 'Gr&uuml;nspargel B&uuml;ndel', price: 4.8, quantity: '500 g', store: 'Coop', placeholder: 'SP' },
      { name: 'Bio-Quinoa', price: 3.9, quantity: '400 g', store: 'Migros', placeholder: 'QN' },
      { name: 'Babyspinat', price: 2.6, quantity: '150 g', store: 'Wochenmarkt', placeholder: 'BS' }
    ],
    tags: ['Meal-Prep 2 Tage', 'Omega-3 aus Leinsamen'],
    shopNotes: {
      coop: 'Coop Naturaline Spargel aus dem Thurgau.',
      migros: 'Migros Bio-Quinoa aus Graub&uuml;nden.',
      aldi: 'Aldi Suisse saisonale Kichererbsen im Glas.',
      'farmers-market': 'Direkt vom Wochenmarkt Z&uuml;rich Helvetiaplatz.'
    },
    co2Source: 'Ecoinvent: Vegetables, asparagus, CH, 2024'
  },
  {
    id: 'fruehling-lean-mass-1',
    season: 'fruehling',
    goal: 'lean-mass',
    diet: ['vegetarian', 'pescetarian', 'omnivore'],
    name: 'Ricotta-Gnocchi Primavera',
    description: 'Leichte Ricotta-Gnocchi mit jungen Erbsen, Spargelspitzen und Zitronen-Zeste.',
    carbon: 2.1,
    macros: { kcal: 630, protein: 34, carbs: 66, fat: 19 },
    pricePerPortion: 9.2,
    products: [
      { name: 'Ricotta Bio', price: 3.8, quantity: '250 g', store: 'Migros', placeholder: 'RC' },
      { name: 'Hartweizengriess', price: 2.2, quantity: '500 g', store: 'Coop', placeholder: 'HG' },
      { name: 'Frische Erbsen', price: 4.4, quantity: '400 g', store: 'Wochenmarkt', placeholder: 'ER' }
    ],
    tags: ['Lean Bulk', 'Calcium'],
    shopNotes: {
      migros: 'Migros S&eacute;lection Ricotta f&uuml;r cremige Konsistenz.',
      coop: 'Coop Prima Gnocchi-Teig als Abk&uuml;rzung.',
      spar: 'Spar Frische Erbsen gek&uuml;hlt.'
    },
    co2Source: 'Ecoinvent: Pasta, fresh, CH, 2024'
  },
  {
    id: 'fruehling-hypertrophy-1',
    season: 'fruehling',
    goal: 'hypertrophy',
    diet: ['omnivore', 'vegetarian', 'pescetarian'],
    name: 'Beluga-Kernotto mit B&auml;rlauch-Pesto',
    description: 'Belugalinsen, Gerstenkernotto und B&auml;rlauch-Pesto mit Bio-Ei als Protein-Boost.',
    carbon: 2.3,
    macros: { kcal: 640, protein: 34, carbs: 68, fat: 18 },
    pricePerPortion: 9.6,
    products: [
      { name: 'Belugalinsen', price: 3.9, quantity: '500 g', store: 'Migros', placeholder: 'BL' },
      { name: 'Gerstenk&ouml;rner', price: 2.8, quantity: '500 g', store: 'Coop', placeholder: 'GK' },
      { name: 'Bio-Eier', price: 5.5, quantity: '6 St&uuml;ck', store: 'Spar', placeholder: 'EI' }
    ],
    tags: ['Proteinreich', 'Eisen &amp; Zink'],
    shopNotes: {
      coop: 'Coop Karma Bio-Eier und Belugalinsen.',
      migros: 'Migros Alnatura B&auml;rlauch f&uuml;r frisches Pesto.',
      spar: 'Spar Regional Eier aus Freilandhaltung.'
    },
    co2Source: 'Ecoinvent: Lentils, dried, CH, 2024'
  },
  {
    id: 'fruehling-fatloss-1',
    season: 'fruehling',
    goal: 'fatloss',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Radiesli-Fenchelsalat mit Apfel',
    description: 'Knackiger Salat aus Radiesli, Fenchel, Apfel und Hanfsamen-Dressing.',
    carbon: 1.4,
    macros: { kcal: 340, protein: 18, carbs: 42, fat: 12 },
    pricePerPortion: 5.4,
    products: [
      { name: 'Radiesli Bund', price: 2.1, quantity: '1 Bund', store: 'Migros', placeholder: 'RA' },
      { name: 'Fenchelknollen', price: 2.8, quantity: '2 St&uuml;ck', store: 'Denner', placeholder: 'FE' },
      { name: '&Auml;pfel Gala', price: 3.2, quantity: '1 kg', store: 'Farmers Market', placeholder: 'AP' }
    ],
    tags: ['Ballaststoffreich', 'Vitamin C Boost'],
    shopNotes: {
      migros: 'Migros Saisonradiesli &amp; Fenchel aus der Region.',
      denner: 'Denner Bio-Apfel f&uuml;r s&uuml;&szlig;e Noten.',
      'farmers-market': 'Lokale Produzenten in Zumikon am Samstag.'
    },
    co2Source: 'Ecoinvent: Root vegetables, mixed, CH, 2024'
  },
  {
    id: 'fruehling-endurance-1',
    season: 'fruehling',
    goal: 'endurance',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Fr&uuml;hlings-Minestrone',
    description: 'Saisonale Minestrone mit Pastinaken, Erbsen und Vollkorn-Pasta.',
    carbon: 1.9,
    macros: { kcal: 480, protein: 24, carbs: 64, fat: 14 },
    pricePerPortion: 6.9,
    products: [
      { name: 'Vollkorn-Pasta', price: 2.5, quantity: '500 g', store: 'Coop', placeholder: 'VP' },
      { name: 'Suppengem&uuml;se', price: 3.2, quantity: '600 g', store: 'Migros', placeholder: 'SG' },
      { name: 'Weisse Bohnen', price: 1.9, quantity: '2 Dosen', store: 'Aldi', placeholder: 'WB' }
    ],
    tags: ['Regeneration', 'Komplexe Kohlenhydrate'],
    shopNotes: {
      coop: 'Coop Naturaplan Vollkornpasta aus der Schweiz.',
      migros: 'Migros Bio-Erbsen tiefgek&uuml;hlt.',
      aldi: 'Aldi Suisse Pastinaken aus Vertragslandwirtschaft.'
    },
    co2Source: 'Ecoinvent: Vegetable soup, CH, 2024'
  },
  {
    id: 'fruehling-power-1',
    season: 'fruehling',
    goal: 'power',
    diet: ['omnivore', 'vegetarian', 'pescetarian'],
    name: 'B&auml;rlauch Power Sandwich',
    description: 'Roggenbrot mit B&auml;rlauch-Hummus, ger&auml;ucherter Forelle und Radieschensalat.',
    carbon: 2.0,
    macros: { kcal: 580, protein: 32, carbs: 54, fat: 20 },
    pricePerPortion: 9.8,
    products: [
      { name: 'Roggenbrot vom Vortag', price: 4.2, quantity: '750 g', store: 'Lokale B&auml;ckerei', placeholder: 'RB' },
      { name: 'B&auml;rlauch Bund', price: 3.1, quantity: '100 g', store: 'Migros', placeholder: 'BL' },
      { name: 'Ger&auml;ucherte Forelle', price: 6.8, quantity: '200 g', store: 'Coop', placeholder: 'FO' }
    ],
    tags: ['Explosive Energie', 'Omega-3'],
    shopNotes: {
      coop: 'Coop Fine Food Forelle aus Aquakultur Graub&uuml;nden.',
      migros: 'Migros B&auml;rlauch nur saisonal verf&uuml;gbar.',
      spar: 'Spar Hummus als Basis wenn es schnell gehen soll.'
    },
    co2Source: 'Ecoinvent: Trout, smoked, CH, 2024'
  },
  {
    id: 'sommer-balanced-1',
    season: 'sommer',
    goal: 'balanced',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Tomaten-Pfirsich Panzanella',
    description: 'Sommersalat mit Tomaten, Pfirsich, Vollkornbrot und Basilikum-Vinaigrette.',
    carbon: 1.6,
    macros: { kcal: 560, protein: 22, carbs: 70, fat: 18 },
    pricePerPortion: 7.8,
    products: [
      { name: 'Strauchtomaten', price: 3.9, quantity: '800 g', store: 'Spar', placeholder: 'TO' },
      { name: 'Reife Pfirsiche', price: 4.2, quantity: '600 g', store: 'Migros', placeholder: 'PF' },
      { name: 'Vollkornbrot', price: 3.5, quantity: '1 Laib', store: 'Coop', placeholder: 'VB' }
    ],
    tags: ['Antioxidantien', 'Hydration'],
    shopNotes: {
      migros: 'Migros Genuss K&ouml;rbchen Pfirsiche aus dem Wallis.',
      coop: 'Coop Slow Bread Vollkorn-Brot vom Vortag nutzen.',
      spar: 'Spar Basilikum im Topf f&uuml;r lange Frische.'
    },
    co2Source: 'Ecoinvent: Tomatoes, open field, CH, 2024'
  },
  {
    id: 'sommer-lean-mass-1',
    season: 'sommer',
    goal: 'lean-mass',
    diet: ['pescetarian', 'omnivore'],
    name: 'Seesaibling Grain Bowl',
    description: 'Gegrillter Seesaibling auf Emmer, Fenchel und Zitrus-Dressing.',
    carbon: 2.4,
    macros: { kcal: 670, protein: 42, carbs: 58, fat: 24 },
    pricePerPortion: 12.5,
    products: [
      { name: 'Seesaibling Filets', price: 14.8, quantity: '400 g', store: 'Coop', placeholder: 'FS' },
      { name: 'Emmer', price: 3.6, quantity: '500 g', store: 'Migros', placeholder: 'EM' },
      { name: 'Fenchel', price: 2.9, quantity: '2 Knollen', store: 'Denner', placeholder: 'FE' }
    ],
    tags: ['Lean Bulk', 'Omega-3'],
    shopNotes: {
      coop: 'Coop Fine Food Seesaibling aus nachhaltiger Zucht.',
      migros: 'Migros Emmer f&uuml;r bissfeste Getreidebasis.',
      denner: 'Denner Fenchel sorgt f&uuml;r Crunch.'
    },
    co2Source: 'Ecoinvent: Fish, farmed, trout, CH, 2024'
  },
  {
    id: 'sommer-hypertrophy-1',
    season: 'sommer',
    goal: 'hypertrophy',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Hanf-Protein Wraps',
    description: 'Vollkornwraps mit schwarzen Bohnen, Hanfsamen und Mais-Paprika-Salsa.',
    carbon: 1.9,
    macros: { kcal: 610, protein: 36, carbs: 66, fat: 20 },
    pricePerPortion: 7.4,
    products: [
      { name: 'Vollkorn-Wraps', price: 3.2, quantity: '6 St&uuml;ck', store: 'Coop', placeholder: 'WR' },
      { name: 'Schwarze Bohnen', price: 1.9, quantity: '2 Dosen', store: 'Denner', placeholder: 'BO' },
      { name: 'Hanfsamen', price: 4.5, quantity: '200 g', store: 'Coop', placeholder: 'HS' }
    ],
    tags: ['Pflanzliches Protein', 'Magnesium'],
    shopNotes: {
      coop: 'Coop Karma Hanfsamen f&uuml;r die Proteinquelle.',
      denner: 'Denner Schweizer Bohnen aus der Dose.',
      'farmers-market': 'Maiskolben frisch vom Bauernhof grillen.'
    },
    co2Source: 'Ecoinvent: Beans, black, organic, CH, 2024'
  },
  {
    id: 'sommer-fatloss-1',
    season: 'sommer',
    goal: 'fatloss',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Zucchetti-Noodle Bowl',
    description: 'Zucchetti-Spiralen mit Kirschtomaten, Rucola und Limetten-Mandel-Sauce.',
    carbon: 1.2,
    macros: { kcal: 310, protein: 16, carbs: 30, fat: 12 },
    pricePerPortion: 5.9,
    products: [
      { name: 'Zucchetti', price: 2.8, quantity: '3 St&uuml;ck', store: 'Migros', placeholder: 'ZU' },
      { name: 'Kirschtomaten', price: 3.4, quantity: '400 g', store: 'Coop', placeholder: 'KT' },
      { name: 'Mandeln', price: 4.1, quantity: '200 g', store: 'Aldi', placeholder: 'MA' }
    ],
    tags: ['Low Carb', 'Entz&uuml;ndungshemmend'],
    shopNotes: {
      migros: 'Migros Daily vegi Zucchetti vor-spiralisiert.',
      coop: 'Coop Rucola aus Bio-Indoor-Farming.',
      aldi: 'Aldi Suisse Mandeln f&uuml;r die Sauce.'
    },
    co2Source: 'Ecoinvent: Courgette, CH, 2024'
  },
  {
    id: 'sommer-endurance-1',
    season: 'sommer',
    goal: 'endurance',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Gersten-Gazpacho',
    description: 'Gek&uuml;hlte Tomaten-Gazpacho mit Schweizer Rollgerste und Minze.',
    carbon: 1.7,
    macros: { kcal: 540, protein: 28, carbs: 72, fat: 15 },
    pricePerPortion: 6.8,
    products: [
      { name: 'Rollgerste', price: 2.6, quantity: '500 g', store: 'Migros', placeholder: 'RG' },
      { name: 'Tomatenmix', price: 4.0, quantity: '900 g', store: 'Spar', placeholder: 'TO' },
      { name: 'Gurken', price: 2.1, quantity: '2 St&uuml;ck', store: 'Coop', placeholder: 'GU' }
    ],
    tags: ['Elektrolyte', 'Meal-Prep f&uuml;r hei&szlig;e Tage'],
    shopNotes: {
      migros: 'Migros Alnatura Rollgerste f&uuml;r satte Basis.',
      coop: 'Coop Minze frisch f&uuml;r die K&uuml;hlung.',
      spar: 'Spar Tomaten in Sommeraktion.'
    },
    co2Source: 'Ecoinvent: Soup, vegetable, chilled, CH, 2024'
  },
  {
    id: 'sommer-power-1',
    season: 'sommer',
    goal: 'power',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Sommer Power Bowl',
    description: 'Hirse, gegrillte Aprikosen, Halloumi und Rote-Bete-Hummus f&uuml;r explosive Einheiten.',
    carbon: 2.2,
    macros: { kcal: 650, protein: 32, carbs: 68, fat: 22 },
    pricePerPortion: 9.4,
    products: [
      { name: 'Hirse', price: 3.1, quantity: '500 g', store: 'Coop', placeholder: 'HI' },
      { name: 'Halloumi', price: 4.5, quantity: '250 g', store: 'Migros', placeholder: 'HA' },
      { name: 'Aprikosen', price: 4.2, quantity: '500 g', store: 'Farmers Market', placeholder: 'AP' }
    ],
    tags: ['Pre-Workout', 'Salty-Sweet'],
    shopNotes: {
      coop: 'Coop Karma Hirse f&uuml;r neutrale Basis.',
      migros: 'Migros Halloumi grillbereit.',
      'farmers-market': 'Aprikosen direkt aus dem Wallis.'
    },
    co2Source: 'Ecoinvent: Cheese, grilling, CH, 2024'
  },
  {
    id: 'herbst-balanced-1',
    season: 'herbst',
    goal: 'balanced',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'K&uuml;rbis-Dinkel Bowl',
    description: 'Ofenk&uuml;rbis mit Dinkel, Federkohl und Haselnuss-Salsa.',
    carbon: 2.1,
    macros: { kcal: 550, protein: 24, carbs: 70, fat: 16 },
    pricePerPortion: 7.6,
    products: [
      { name: 'Butternuss-K&uuml;rbis', price: 4.5, quantity: '1.2 kg', store: 'Coop', placeholder: 'KB' },
      { name: 'UrDinkel', price: 3.4, quantity: '500 g', store: 'Migros', placeholder: 'DI' },
      { name: 'Federkohl', price: 2.8, quantity: '250 g', store: 'Farmers Market', placeholder: 'FK' }
    ],
    tags: ['Beta-Carotin', 'Saison Herbst'],
    shopNotes: {
      coop: 'Coop Pumpkins aus Schweizer Freilandproduktion.',
      migros: 'Migros UrDinkel f&uuml;r komplexe Kohlenhydrate.',
      denner: 'Denner Haseln&uuml;sse aus dem Tessin.'
    },
    co2Source: 'Ecoinvent: Pumpkin, CH, 2024'
  },
  {
    id: 'herbst-lean-mass-1',
    season: 'herbst',
    goal: 'lean-mass',
    diet: ['vegetarian', 'pescetarian', 'omnivore'],
    name: 'Wildreis-Pilz Pilaf',
    description: 'Wildreis mit Eierschw&auml;mmen, Trauben und zweierlei Kernen.',
    carbon: 2.3,
    macros: { kcal: 620, protein: 30, carbs: 68, fat: 18 },
    pricePerPortion: 8.9,
    products: [
      { name: 'Wildreis Mix', price: 4.8, quantity: '500 g', store: 'Coop', placeholder: 'WR' },
      { name: 'Eierschw&auml;mme', price: 6.5, quantity: '300 g', store: 'Migros', placeholder: 'PI' },
      { name: 'Weintrauben', price: 3.6, quantity: '500 g', store: 'Denner', placeholder: 'TR' }
    ],
    tags: ['Lean Bulk', 'Polyphenole'],
    shopNotes: {
      coop: 'Coop Miini Region Wildreis aus dem Tessin.',
      migros: 'Migros Pilztheke mit frischen Eierschw&auml;mmen.',
      denner: 'Denner Trauben saisonal reduziert.'
    },
    co2Source: 'Ecoinvent: Mushrooms, cultivated, CH, 2024'
  },
  {
    id: 'herbst-hypertrophy-1',
    season: 'herbst',
    goal: 'hypertrophy',
    diet: ['omnivore', 'vegetarian', 'pescetarian'],
    name: 'Pilz-Polenta Bake',
    description: 'Cremige Polenta mit Steinpilzen, Sbrinz und Traubenkern&ouml;l.',
    carbon: 2.4,
    macros: { kcal: 660, protein: 36, carbs: 62, fat: 24 },
    pricePerPortion: 8.8,
    products: [
      { name: 'Polenta grob', price: 2.4, quantity: '500 g', store: 'Coop', placeholder: 'PO' },
      { name: 'Steinpilze getrocknet', price: 7.2, quantity: '100 g', store: 'Spar', placeholder: 'SP' },
      { name: 'Sbrinz AOP', price: 5.6, quantity: '200 g', store: 'Migros', placeholder: 'SB' }
    ],
    tags: ['Recovery', 'Kalziumquelle'],
    shopNotes: {
      spar: 'Spar Schweizer Steinpilze (getrocknet) im Herbstsortiment.',
      coop: 'Coop Sbrinz AOP f&uuml;r intensiven Geschmack.',
      migros: 'Migros Traubenkern&ouml;l aus der Region.'
    },
    co2Source: 'Ecoinvent: Cheese, hard, CH, 2024'
  },
  {
    id: 'herbst-fatloss-1',
    season: 'herbst',
    goal: 'fatloss',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Rotkraut-Apfel Slaw',
    description: 'Rotkraut, Apfel, Cranberries und ger&ouml;stete K&uuml;rbiskerne mit Apfelessig-Dressing.',
    carbon: 1.5,
    macros: { kcal: 320, protein: 14, carbs: 38, fat: 12 },
    pricePerPortion: 5.2,
    products: [
      { name: 'Rotkraut', price: 2.9, quantity: '1 Kopf', store: 'Migros', placeholder: 'RK' },
      { name: 'Bio-&Auml;pfel', price: 3.5, quantity: '1 kg', store: 'Denner', placeholder: 'AP' },
      { name: 'K&uuml;rbiskerne', price: 4.1, quantity: '200 g', store: 'Farmers Market', placeholder: 'KK' }
    ],
    tags: ['Vitamin K', 'Immun Boost'],
    shopNotes: {
      migros: 'Migros Bio-Rotkraut und Winter&auml;pfel.',
      denner: 'Denner Cranberries unges&uuml;&szlig;t.',
      'farmers-market': 'K&uuml;rbiskerne direkt vom Hof.'
    },
    co2Source: 'Ecoinvent: Cabbage, red, CH, 2024'
  },
  {
    id: 'herbst-endurance-1',
    season: 'herbst',
    goal: 'endurance',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Beluga Trauben Tabbouleh',
    description: 'Belugalinsen, Petersilie, Trauben und Zitronen-Dressing mit Waln&uuml;ssen.',
    carbon: 2.0,
    macros: { kcal: 560, protein: 30, carbs: 74, fat: 14 },
    pricePerPortion: 6.9,
    products: [
      { name: 'Belugalinsen', price: 3.9, quantity: '500 g', store: 'Migros', placeholder: 'BL' },
      { name: 'Petersilie Bund', price: 1.8, quantity: '2 B&uuml;ndel', store: 'Coop', placeholder: 'PE' },
      { name: 'Waln&uuml;sse', price: 5.5, quantity: '250 g', store: 'Aldi', placeholder: 'WN' }
    ],
    tags: ['Langzeit-Energie', 'Polyphenole'],
    shopNotes: {
      coop: 'Coop Trauben aus dem Wallis.',
      migros: 'Migros Bio-Belugalinsen im Angebot.',
      aldi: 'Aldi Suisse Waln&uuml;sse aus Graub&uuml;nden.'
    },
    co2Source: 'Ecoinvent: Lentils, dried, CH, 2024'
  },
  {
    id: 'herbst-power-1',
    season: 'herbst',
    goal: 'power',
    diet: ['omnivore', 'vegetarian', 'pescetarian'],
    name: 'Randen Power Risotto',
    description: 'Randenrisotto mit Meerrettich, Ziegenfrischk&auml;se und karamellisierten Zwiebeln.',
    carbon: 2.6,
    macros: { kcal: 640, protein: 28, carbs: 76, fat: 22 },
    pricePerPortion: 9.1,
    products: [
      { name: 'Arborio Reis', price: 3.4, quantity: '500 g', store: 'Coop', placeholder: 'AR' },
      { name: 'Randen vorgegart', price: 3.2, quantity: '500 g', store: 'Denner', placeholder: 'RA' },
      { name: 'Ziegenfrischk&auml;se', price: 4.8, quantity: '200 g', store: 'Migros', placeholder: 'ZG' }
    ],
    tags: ['Explosive Energie', 'Nitrat Booster'],
    shopNotes: {
      coop: 'Coop Risotto-Reis aus dem Piemont.',
      denner: 'Denner Randen bereits gegart.',
      migros: 'Migros Terra Suisse Meerrettich f&uuml;r Sch&auml;rfe.'
    },
    co2Source: 'Ecoinvent: Beetroot, cooked, CH, 2024'
  },
  {
    id: 'winter-balanced-1',
    season: 'winter',
    goal: 'balanced',
    diet: ['vegetarian', 'pescetarian', 'omnivore'],
    name: 'Rosenkohl Traybake',
    description: 'Rosenkohl, Pastinaken und Birnen auf einem Blech, serviert mit H&uuml;ttenk&auml;se-Dip.',
    carbon: 2.6,
    macros: { kcal: 520, protein: 24, carbs: 58, fat: 18 },
    pricePerPortion: 7.2,
    products: [
      { name: 'Rosenkohl', price: 3.4, quantity: '600 g', store: 'Coop', placeholder: 'RK' },
      { name: 'Pastinaken', price: 2.7, quantity: '500 g', store: 'Migros', placeholder: 'PA' },
      { name: 'H&uuml;ttenk&auml;se', price: 2.9, quantity: '250 g', store: 'Denner', placeholder: 'HK' }
    ],
    tags: ['Vitamin C', 'Meal-Prep 3 Tage'],
    shopNotes: {
      coop: 'Coop Naturaplan Rosenkohl aus dem Seeland.',
      migros: 'Migros Pastinaken aus regionalem Anbau.',
      denner: 'Denner Schweizer Frischk&auml;se als leichte Alternative.'
    },
    co2Source: 'Ecoinvent: Sprouts, Brussels, CH, 2024'
  },
  {
    id: 'winter-lean-mass-1',
    season: 'winter',
    goal: 'lean-mass',
    diet: ['pescetarian', 'omnivore'],
    name: 'Saibling S&uuml;&szlig;kartoffel Gratin',
    description: 'Ofengebackene S&uuml;&szlig;kartoffeln mit Saibling, Gr&uuml;nkohl und Zitronen-Creme.',
    carbon: 2.7,
    macros: { kcal: 680, protein: 38, carbs: 66, fat: 24 },
    pricePerPortion: 11.8,
    products: [
      { name: 'Saiblingsfilets', price: 13.6, quantity: '400 g', store: 'Migros', placeholder: 'FS' },
      { name: 'S&uuml;&szlig;kartoffeln', price: 3.9, quantity: '1 kg', store: 'Coop', placeholder: 'SK' },
      { name: 'Gr&uuml;nkohl', price: 3.2, quantity: '300 g', store: 'Farmers Market', placeholder: 'GK' }
    ],
    tags: ['Lean Bulk', 'Omega-3'],
    shopNotes: {
      migros: 'Migros Bio-Saibling aus Seeforelle.',
      coop: 'Coop S&uuml;&szlig;kartoffeln aus Spanien &mdash; saisonal begrenzt.',
      'farmers-market': 'Gr&uuml;nkohl frisch aus Z&uuml;rcher Oberland.'
    },
    co2Source: 'Ecoinvent: Fish, trout, CH, 2024'
  },
  {
    id: 'winter-hypertrophy-1',
    season: 'winter',
    goal: 'hypertrophy',
    diet: ['vegetarian', 'pescetarian', 'omnivore'],
    name: 'Linsen-Sp&auml;tzli mit Sbrinz',
    description: 'Hausgemachte Vollkorn-Sp&auml;tzli mit Linsenragout, Karotten und Sbrinz-Dressing.',
    carbon: 2.8,
    macros: { kcal: 690, protein: 36, carbs: 70, fat: 24 },
    pricePerPortion: 8.9,
    products: [
      { name: 'Vollkorn-Sp&auml;tzli', price: 3.2, quantity: '500 g', store: 'Migros', placeholder: 'SP' },
      { name: 'Linsenmix', price: 3.6, quantity: '500 g', store: 'Coop', placeholder: 'LI' },
      { name: 'Sbrinz AOP', price: 5.6, quantity: '200 g', store: 'Spar', placeholder: 'SB' }
    ],
    tags: ['High Protein', 'Winter Comfort'],
    shopNotes: {
      migros: 'Migros Vollkorn-Sp&auml;tzli Teig aus der Frischetheke.',
      coop: 'Coop Linsenmix f&uuml;r schnelle Zubereitung.',
      spar: 'Spar Sbrinz AOP in der K&auml;setheke.'
    },
    co2Source: 'Ecoinvent: Pasta, wholegrain, CH, 2024'
  },
  {
    id: 'winter-fatloss-1',
    season: 'winter',
    goal: 'fatloss',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Sellerie-Apfel Suppe',
    description: 'Cremige Suppe aus Sellerie, Apfel, Lauch und Hafermilch, getoppt mit Randenchips.',
    carbon: 1.9,
    macros: { kcal: 290, protein: 10, carbs: 36, fat: 9 },
    pricePerPortion: 4.9,
    products: [
      { name: 'Knollensellerie', price: 2.4, quantity: '1 St&uuml;ck', store: 'Coop', placeholder: 'SE' },
      { name: 'Lauchstangen', price: 2.1, quantity: '2 St&uuml;ck', store: 'Migros', placeholder: 'LA' },
      { name: 'Haferdrink', price: 2.6, quantity: '1 l', store: 'Denner', placeholder: 'HD' }
    ],
    tags: ['W&auml;rmend', 'Ballaststoffreich'],
    shopNotes: {
      coop: 'Coop Lauch &amp; Sellerie aus dem Schweizer Mittelland.',
      migros: 'Migros Alnatura Haferdrink.',
      denner: 'Denner Randen vorgegart f&uuml;r knusprige Chips.'
    },
    co2Source: 'Ecoinvent: Soup, vegetable, CH, 2024'
  },
  {
    id: 'winter-endurance-1',
    season: 'winter',
    goal: 'endurance',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Hirse-Sanddorn Porridge',
    description: 'Warmer Hirsebrei mit Sanddornp&uuml;ree, Birne und ger&ouml;steten Haseln&uuml;ssen.',
    carbon: 2.5,
    macros: { kcal: 610, protein: 22, carbs: 82, fat: 18 },
    pricePerPortion: 6.7,
    products: [
      { name: 'Hirse gesch&auml;lt', price: 3.1, quantity: '500 g', store: 'Migros', placeholder: 'HI' },
      { name: 'Sanddornp&uuml;ree', price: 4.2, quantity: '250 g', store: 'Coop', placeholder: 'SA' },
      { name: 'Haseln&uuml;sse', price: 5.4, quantity: '250 g', store: 'Farmers Market', placeholder: 'HN' }
    ],
    tags: ['Immunstark', 'Schnelle Energie'],
    shopNotes: {
      migros: 'Migros Bio-Hirse &amp; Sanddornp&uuml;ree aus dem Tiefk&uuml;hlregal.',
      coop: 'Coop Haseln&uuml;sse aus dem Wallis.',
      'farmers-market': 'Birnen direkt vom Hofladen in Zumikon.'
    },
    co2Source: 'Ecoinvent: Millet, hulled, CH, 2024'
  },
  {
    id: 'winter-power-1',
    season: 'winter',
    goal: 'power',
    diet: ['vegan', 'vegetarian', 'pescetarian', 'omnivore'],
    name: 'Kastanien Power Eintopf',
    description: 'Schweizer Marroni, Schwarzkohl, Rauchtofu und Gerste f&uuml;r intensive Trainingstage.',
    carbon: 2.7,
    macros: { kcal: 660, protein: 34, carbs: 76, fat: 20 },
    pricePerPortion: 8.5,
    products: [
      { name: 'Marroni vorgegart', price: 4.8, quantity: '400 g', store: 'Coop', placeholder: 'MA' },
      { name: 'Schwarzkohl', price: 3.2, quantity: '250 g', store: 'Migros', placeholder: 'SK' },
      { name: 'Rauchtofu', price: 4.1, quantity: '200 g', store: 'Spar', placeholder: 'TF' }
    ],
    tags: ['Explosive Energie', 'Eisenreich'],
    shopNotes: {
      coop: 'Coop Saison Marroni vakuumiert.',
      migros: 'Migros Schwarzkohl im Bio-Korb.',
      spar: 'Spar Rauchtofu aus Schweizer Soja.'
    },
    co2Source: 'Ecoinvent: Chestnuts, cooked, CH, 2024'
  }
];

function detectSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) {
    return 'fruehling';
  }
  if (month >= 6 && month <= 8) {
    return 'sommer';
  }
  if (month >= 9 && month <= 11) {
    return 'herbst';
  }
  return 'winter';
}

const mealForm = doc.querySelector('[data-meal-form]');
if (mealForm instanceof HTMLFormElement) {
  mealForm.addEventListener('submit', event => event.preventDefault());
}

if (locationSelect instanceof HTMLSelectElement) {
  locationSelect.addEventListener('change', () => {
    const chain = locationSelect.value;
    if (lastSuggestedStore && lastSuggestedStore.chain === chain) {
      setStoreStatus(lastSuggestedStore.message, 'success');
      updateStoreSuggestionHighlight(lastSuggestedStore.id);
      return;
    }
    lastSuggestedStore = null;
    updateStoreSuggestionHighlight(null);
    if (!locatingStore) {
      setStoreStatus(defaultStoreStatusMessage, 'info');
    }
  });
}

if (autoLocateStoreBtn) {
  autoLocateStoreBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      lastSuggestedStore = null;
      setStoreStatus('Dein Browser unterstuetzt keine Standortermittlung.', 'error');
      clearStoreSuggestions();
      return;
    }
    if (locatingStore) {
      return;
    }
    locatingStore = true;
    setStoreStatus('Wir suchen nach Laeden in deiner Naehe ...', 'pending');
    navigator.geolocation.getCurrentPosition(
      position => {
        locatingStore = false;
        const { latitude, longitude } = position.coords || {};
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          lastSuggestedStore = null;
          setStoreStatus('Die Position ist aktuell nicht verfuegbar.', 'error');
          clearStoreSuggestions();
          return;
        }
        const nearby = presentStoreSuggestions(
          { lat: latitude, lon: longitude },
          'deinem Standort'
        );
        if (!nearby.length) {
          lastSuggestedStore = null;
          setStoreStatus('Wir konnten keinen passenden Laden finden.', 'error');
          clearStoreSuggestions();
          return;
        }
        applyStoreSelection(nearby[0]);
      },
      error => {
        locatingStore = false;
        lastSuggestedStore = null;
        setStoreStatus(getGeolocationErrorMessage(error), 'error');
        clearStoreSuggestions();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
}

if (manualLocateStoreBtn) {
  manualLocateStoreBtn.addEventListener('click', () => {
    const rawValue = manualLocationInput?.value ?? '';
    if (!rawValue.trim()) {
      lastSuggestedStore = null;
      setStoreStatus('Bitte gib eine PLZ, einen Ort oder eine Adresse ein.', 'error');
      clearStoreSuggestions();
      return;
    }
    const match = findKnownLocation(rawValue);
    if (!match) {
      lastSuggestedStore = null;
      setStoreStatus(
        `Standort nicht erkannt. Unterstuetzte Orte: ${supportedLocationsText}.`,
        'error'
      );
      clearStoreSuggestions();
      return;
    }
    setStoreStatus(`Top Vorschlaege fuer ${match.label} werden geladen ...`, 'pending');
    if (manualLocationInput) {
      manualLocationInput.value = match.label;
    }
    const nearby = presentStoreSuggestions(
      { lat: match.lat, lon: match.lon },
      match.labelHtml
    );
    if (!nearby.length) {
      lastSuggestedStore = null;
      setStoreStatus('Wir konnten keinen passenden Laden finden.', 'error');
      clearStoreSuggestions();
      return;
    }
    applyStoreSelection(nearby[0]);
  });
}

if (manualLocationInput) {
  manualLocationInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      manualLocateStoreBtn?.click();
    }
  });
}

if (storeSuggestionsContainer) {
  storeSuggestionsContainer.addEventListener('click', event => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest('[data-store-id]');
    if (!button) {
      return;
    }
    event.preventDefault();
    const storeId = button.getAttribute('data-store-id');
    const store =
      recentStoreSuggestions.find(item => item.id === storeId) ||
      storeLocations.find(item => item.id === storeId);
    if (!store) {
      return;
    }
    const enrichedStore =
      recentStoreSuggestions.find(item => item.id === storeId) ||
      { ...store, distanceKm: NaN, distanceText: '' };
    applyStoreSelection(enrichedStore);
  });
}

const mealButton = doc.getElementById('generateMeal');
const mealOutput = doc.getElementById('mealOutput');
const SUGGESTION_COUNT = 6;

function getSelectValue(id, fallback) {
  const element = doc.getElementById(id);
  return element instanceof HTMLSelectElement ? element.value : fallback;
}

function showMealNotFound() {
  if (!(mealOutput instanceof HTMLElement)) {
    return;
  }
  mealOutput.innerHTML = '<div class="planner-result planner-result--empty"><p>Aktuell haben wir noch keine passenden Meal-Prep-Ideen f&uuml;r diese Kombination. Passe Ziel oder Ern&auml;hrungsstil an und versuche es erneut.</p></div>';
}

function getEcoScore(carbonKg) {
  if (!Number.isFinite(carbonKg)) {
    return {
      label: '&ndash;',
      tier: 'neutral',
      description: 'Keine Eco-Bewertung verf&uuml;gbar.'
    };
  }
  if (carbonKg <= 1.3) {
    return {
      label: 'A',
      tier: 'excellent',
      description: 'Sehr klimafreundlich &mdash; ideal f&uuml;r ein leichtes CO<sub>2</sub>-Budget.'
    };
  }
  if (carbonKg <= 1.8) {
    return {
      label: 'B',
      tier: 'good',
      description: 'Gut ausbalanciert mit niedrigem Emissionsfu&szlig;abdruck.'
    };
  }
  if (carbonKg <= 2.3) {
    return {
      label: 'C',
      tier: 'balanced',
      description: 'Solide Wahl &mdash; CO<sub>2</sub>-Emissionen im empfohlenen Bereich.'
    };
  }
  if (carbonKg <= 2.8) {
    return {
      label: 'D',
      tier: 'attention',
      description: 'Noch optimierbar &mdash; w&auml;hle lokale Zutaten, um Emissionen zu senken.'
    };
  }
  return {
    label: 'E',
    tier: 'critical',
    description: 'Hoher CO<sub>2</sub>-Wert &mdash; verwende Alternativen mit saisonalen Produkten.'
  };
}

function getEcoMeterWidth(carbonKg) {
  if (!Number.isFinite(carbonKg)) {
    return 0;
  }
  const referenceMax = 3.5;
  const clamped = Math.min(referenceMax, Math.max(0, carbonKg));
  const score = Math.max(8, Math.round(((referenceMax - clamped) / referenceMax) * 100));
  return score;
}

function formatPrice(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  try {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 2
    }).format(value);
  } catch (error) {
    return `CHF ${value.toFixed(2)}`;
  }
}

function getProductPlaceholder(product) {
  const source = (product?.placeholder || product?.name || '').toString();
  const initials = source.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  return initials || 'PR';
}

function renderProductList(products) {
  if (!Array.isArray(products) || !products.length) {
    return '';
  }
  const itemsMarkup = products
    .map(product => {
      const priceText = Number.isFinite(product?.price)
        ? formatPrice(product.price)
        : product?.price || '';
      const metaParts = [];
      if (product?.quantity) {
        metaParts.push(`<span class="product-quantity">${product.quantity}</span>`);
      }
      if (product?.store) {
        metaParts.push(`<span class="product-store">${product.store}</span>`);
      }
      if (product?.note) {
        metaParts.push(`<span class="product-note">${product.note}</span>`);
      }
      const metaMarkup = metaParts.length
        ? `<div class="product-meta">${metaParts.join('')}</div>`
        : '';
      const placeholder = getProductPlaceholder(product);
      const imageMarkup = product?.image
        ? `<img class="product-thumb" src="${product.image}" alt="${product.name}">`
        : `<div class="product-thumb product-thumb--placeholder" aria-hidden="true">${placeholder}</div>`;
      return `
        <li class="product-item">
          ${imageMarkup}
          <div class="product-info">
            <p class="product-name">${product?.name ?? 'Produkt'}</p>
            ${metaMarkup}
          </div>
          <div class="product-price">${priceText ?? ''}</div>
        </li>
      `;
    })
    .join('');
  return `
    <div class="product-section">
      <h4 class="product-heading">Einkaufsliste</h4>
      <ul class="product-list">
        ${itemsMarkup}
      </ul>
    </div>
  `;
}

function buildMealMarkup(meal, selection) {
  if (!(mealOutput instanceof HTMLElement)) {
    return '';
  }
  const tagsMarkup = meal.tags && meal.tags.length
    ? `<div class="tag-row">${meal.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
    : '';
  const shopTip = meal.shopNotes && selection.location ? meal.shopNotes[selection.location] : '';
  const shopNoteMarkup = shopTip ? `<p class="shop-tip">${shopTip}</p>` : '';
  const storeSuggestionMarkup =
    lastSuggestedStore && lastSuggestedStore.chain === selection.location
      ? `<p class="store-suggestion">Empfohlener Laden: ${lastSuggestedStore.name}${
          lastSuggestedStore.distanceText ? ` (${lastSuggestedStore.distanceText} entfernt)` : ''
        }</p>`
      : '';
  const carbonValue = typeof meal.carbon === 'number' ? meal.carbon.toFixed(1) : meal.carbon;
  const ecoScore = getEcoScore(typeof meal.carbon === 'number' ? meal.carbon : NaN);
  const ecoMeterWidth = getEcoMeterWidth(typeof meal.carbon === 'number' ? meal.carbon : NaN);
  const ecoBadgeMarkup = `<span class="badge badge--eco eco-score-badge eco-score-badge--${ecoScore.tier}">Eco-Score ${ecoScore.label}</span>`;
  const ecoMeterMarkup = ecoMeterWidth
    ? `<div class="eco-meter" role="img" aria-label="Eco-Score ${ecoScore.label}"><span class="eco-meter__bar eco-meter__bar--${ecoScore.tier}" style="width: ${ecoMeterWidth}%;"></span></div>`
    : '';
  const priceText = Number.isFinite(meal.pricePerPortion)
    ? formatPrice(meal.pricePerPortion)
    : meal.pricePerPortion || null;
  const priceMarkup = priceText
    ? `<p class="meal-price"><span>Preis pro Portion</span><strong>${priceText}</strong></p>`
    : '';
  const productsMarkup = renderProductList(meal.products);
  return `
    <article class="planner-result">
      <header class="planner-result-header">
        <div>
          <h3>${meal.name}</h3>
          <p class="eco-score-detail">${ecoScore.description}</p>
        </div>
        <div class="planner-result-tags">
          <span class="badge badge--season">${seasonLabels[meal.season] ?? meal.season}</span>
          <span class="badge">${goalLabels[meal.goal] ?? meal.goal}</span>
          <span class="badge badge--co2">${carbonValue} kg CO<sub>2</sub>e</span>
          ${ecoScore.label === '&ndash;' ? '' : ecoBadgeMarkup}
        </div>
      </header>
      <p>${meal.description}</p>
      <ul class="macro-list">
        <li><strong>${meal.macros.kcal}</strong> kcal</li>
        <li><strong>${meal.macros.protein}</strong> g Protein</li>
        <li><strong>${meal.macros.carbs}</strong> g Kohlenhydrate</li>
        <li><strong>${meal.macros.fat}</strong> g Fett</li>
      </ul>
      ${priceMarkup}
      ${productsMarkup}
      ${tagsMarkup}
      ${storeSuggestionMarkup}
      ${shopNoteMarkup}
      ${ecoMeterMarkup}
      <p class="co2-source">${meal.co2Source}</p>
    </article>
  `;
}

function renderMeals(meals, selection) {
  if (!(mealOutput instanceof HTMLElement)) {
    return;
  }
  mealOutput.innerHTML = `
    <div class="planner-result-grid">
      ${meals.map(meal => buildMealMarkup(meal, selection)).join('')}
    </div>
  `;
}

function selectRandomItems(source, count) {
  const pool = [...source];
  const selection = [];
  while (pool.length && selection.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    selection.push(pool.splice(index, 1)[0]);
  }
  return selection;
}

if (mealButton instanceof HTMLButtonElement && mealOutput) {
  mealButton.addEventListener('click', () => {
    const selection = {
      season: detectSeason(),
      goal: getSelectValue('fitnessGoal', 'balanced'),
      location: getSelectValue('location', 'coop'),
      diet: getSelectValue('dietPreference', 'omnivore')
    };
    let matches = mealDataset.filter(meal => {
      return meal.season === selection.season &&
        meal.goal === selection.goal &&
        meal.diet.includes(selection.diet);
    });
    if (!matches.length && selection.diet !== 'omnivore') {
      matches = mealDataset.filter(meal => meal.season === selection.season && meal.goal === selection.goal);
    }
    if (!matches.length) {
      showMealNotFound();
      return;
    }
    const suggestionPool = [...matches];
    const seenIds = new Set(suggestionPool.map(item => item.id));
    if (suggestionPool.length < SUGGESTION_COUNT) {
      mealDataset.forEach(item => {
        if (item.goal === selection.goal && !seenIds.has(item.id)) {
          suggestionPool.push(item);
          seenIds.add(item.id);
        }
      });
    }
    if (suggestionPool.length < SUGGESTION_COUNT) {
      mealDataset.forEach(item => {
        if (!seenIds.has(item.id)) {
          suggestionPool.push(item);
          seenIds.add(item.id);
        }
      });
    }
    const suggestions = selectRandomItems(
      suggestionPool,
      Math.min(suggestionPool.length, SUGGESTION_COUNT)
    );
    renderMeals(suggestions, selection);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mealOutput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

initCookieBanner();













