// Native features through Capacitor plugins, with browser fallbacks for testing.
const Cap = window.Capacitor;
export const isNative = !!Cap?.isNativePlatform?.();
const P = name => Cap?.Plugins?.[name];

// Server address. In the app the screens are bundled in the APK, so the API is remote.
export const API_URL = isNative ? (window.LUDO_API_URL || 'https://ludoreal.in') : '';

// ---------- sign-in (Firebase Authentication) ----------
async function idToken() {
  const { token } = await P('FirebaseAuthentication').getIdToken({ forceRefresh: true });
  return token;
}

export async function signInWithGoogle() {
  if (!isNative) throw new Error('Google sign-in works in the Android app');
  await P('FirebaseAuthentication').signInWithGoogle();
  return idToken();
}

export async function signInAsGuest() {
  if (!isNative) return null;               // browser testing uses the dev login instead
  await P('FirebaseAuthentication').signInAnonymously();
  return idToken();
}

export async function signOutNative() {
  if (isNative) await P('FirebaseAuthentication').signOut().catch(() => {});
}

// ---------- device helpers ----------
export async function share(title, text, url) {
  try {
    if (isNative && P('Share')) return await P('Share').share({ title, text, url, dialogTitle: title });
    if (navigator.share) return await navigator.share({ title, text, url });
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch { return null; }
}

export function openUrl(url) {
  if (!url) return;
  if (isNative && P('Browser')) P('Browser').open({ url });
  else window.open(url, '_blank', 'noopener');
}

let vibrateOn = (() => { try { return localStorage.getItem('lr_vibrate') !== '0'; } catch { return true; } })();
export const vibrationEnabled = () => vibrateOn;
export function setVibration(v) { vibrateOn = v; try { localStorage.setItem('lr_vibrate', v ? '1' : '0'); } catch { /* ignore */ } }
export function vibrate(ms = 30) {
  if (!vibrateOn) return;
  try { if (isNative && P('Haptics')) P('Haptics').vibrate({ duration: ms }); else navigator.vibrate?.(ms); } catch { /* ignore */ }
}

// Android back button: the current screen decides; return true when handled.
let backHandler = null;
export function onBack(fn) { backHandler = fn; }
if (isNative && P('App')) {
  P('App').addListener('backButton', () => {
    if (backHandler && backHandler()) return;
    P('App').minimizeApp();
  });
}
