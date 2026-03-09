import { useEffect, useMemo, useState } from "react";

export const APP_LANGUAGE_KEY = "airtalk_language";

export const appLanguageOptions = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Spanish",
  "French",
  "Arabic",
  "Chinese",
] as const;

export type AppLanguage = (typeof appLanguageOptions)[number];

type TranslationMap = Record<string, string>;

const english: TranslationMap = {
  "common.home": "Home",
  "common.scan": "Scan",
  "common.settings": "Settings",
  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.accept": "Accept",
  "common.decline": "Decline",
  "common.send": "Send",
  "common.offline": "Offline",
  "common.online": "Online",

  "intro.title": "Air Talk",
  "intro.goal": "Main goal: secure online + offline communication with direct nearby discovery, fast chat, and resilient local identity.",
  "intro.welcome": "AirTalk Welcome",
  "intro.selectLanguage": "Select language",
  "intro.saved": "Language preference is saved and used across the app experience.",
  "intro.start": "Start App",
  "intro.currentLanguage": "Current language",

  "login.back": "Back to Welcome",
  "login.title": "AirTalk Login",
  "login.subtitle": "Choose online login or direct offline mode.",
  "login.onlineTab": "Online Login",
  "login.offlineTab": "Offline Mode",
  "login.uniqueId": "User Unique ID",
  "login.uniqueIdPlaceholder": "your-unique-id",
  "login.password": "Password",
  "login.button": "Login",
  "login.loggingIn": "Logging in...",
  "login.create": "Create new account?",
  "login.signup": "Signup Register",
  "login.name": "Name",
  "login.namePlaceholder": "Your name",
  "login.offlineButton": "Offline Login",
  "login.savedLocal": "Login data is saved locally for offline mode continuity.",

  "signup.title": "Signup Register",
  "signup.subtitle": "Create online account and keep the same profile for offline mode.",
  "signup.name": "User Name",
  "signup.uniqueId": "User Unique ID",
  "signup.password": "Password",
  "signup.passwordPlaceholder": "Create password",
  "signup.button": "Signup",
  "signup.creating": "Creating account...",
  "signup.already": "Already have account?",
  "signup.backLogin": "Back to Online Login",

  "home.offlineUser": "Offline User",
  "home.onlineTalk": "Online Talk",
  "home.offlineTalk": "Offline Talk",
  "home.notifications": "Notifications",
  "home.noPending": "No pending friend requests.",
  "home.friendRequest": "Friend request",
  "home.permissionStatus": "Hardware Permission Status",
  "home.missing": "Missing",
  "home.fixPermissions": "Fix permissions",
  "home.allPermissions": "All permissions granted",
  "home.noOnlineUsers": "No online users",
  "home.noOfflineUsers": "No offline nearby users",
  "home.noOnlineHint": "Switch to Offline mode or wait for contacts to come online.",
  "home.noOfflineHint": "Run Scan to discover nearby WiFi Direct users.",
  "home.tapToChat": "Tap to chat",
  "home.you": "You",
  "home.youPrefix": "You:",
  "home.sentAttachment": "sent an attachment",
  "home.range": "Range",

  "scan.title": "Scan Nearby",
  "scan.onlineMode": "Online Mode",
  "scan.offlineMode": "Offline Mode",
  "scan.sendRequestTo": "Send request to",
  "scan.typeMessage": "Type a message (optional)",
  "scan.searchingOnline": "Searching online users...",
  "scan.sweeping": "Sweeping WiFi Direct channels...",
  "scan.readyOnline": "Ready to find online users",
  "scan.readyOffline": "Ready for nearby offline discovery",
  "scan.start": "Start Radar Scan",
  "scan.defaultSender": "Default Sender",
  "scan.noUsersYet": "No users shown yet",
  "scan.noUsersYetOnline": "Tap Start Radar Scan to load online users.",
  "scan.noUsersYetOffline": "Tap Start Radar Scan to discover nearby offline users.",
  "scan.noUsersFound": "No users found",
  "scan.noUsersFoundOnline": "Only online users are shown in Online mode.",
  "scan.noUsersFoundOffline": "No nearby WiFi Direct users found yet.",
  "scan.uniqueId": "Unique ID",
  "scan.notSet": "Not set",
  "scan.deviceId": "Device ID",
  "scan.tapSendRequest": "Tap to send Request",
  "scan.nearby": "Nearby",
  "scan.testIncoming": "Test Incoming Request",

  "settings.title": "Settings",
  "settings.subtitle": "Profile, network, permissions and theme controls",
  "settings.permissions": "Permissions screen",
  "settings.unblockListAction": "Unblock list",
  "settings.unblockListTitle": "Blocked users",
  "settings.unblockListSubtitle": "Manage blocked users from one place",
  "settings.unblockListEmpty": "No blocked users",
  "settings.unblockListEmptyHint": "Block users from Home hold options to manage them here.",
  "settings.unblock": "Unblock",
  "settings.unknownUser": "Unknown user",
  "settings.disconnect": "Disconnect device",
  "settings.disconnectTitle": "Disconnect this device?",
  "settings.disconnectOnline": "Do you want to save online login info in local storage for next autofill?",
  "settings.disconnectOffline": "This will disconnect and return to the welcome intro page.",
  "settings.logoutOnly": "Logout only",
  "settings.saveLogout": "Save & Logout",
  "settings.disconnectOnly": "Disconnect",

  "appearance.title": "Theme Appearance",
  "appearance.description": "Use one style setup in both Offline and Online mode",
  "appearance.help": "Change dark mode, Home/Chat wallpaper, and app button color.",
  "appearance.infoButton": "Theme info bar button",
  "appearance.open": "Open",
  "appearance.dialogDescription": "These options work across the full app in online/offline mode.",
  "appearance.darkMode": "Dark mode",
  "appearance.wallpaper": "Chat & Home wallpaper",
  "appearance.uploadWallpaper": "Upload wallpaper image",
  "appearance.templates": "Preloaded wallpaper templates",
  "appearance.buttonColor": "App button color",
  "appearance.language": "App language",
  "appearance.save": "Save appearance",
};

const withBase = (overrides: TranslationMap): TranslationMap => ({ ...english, ...overrides });

const translations: Record<AppLanguage, TranslationMap> = {
  English: english,
  Hindi: withBase({
    "common.home": "होम",
    "common.scan": "स्कैन",
    "common.settings": "सेटिंग्स",
    "common.cancel": "रद्द करें",
    "common.save": "सेव करें",
    "common.accept": "स्वीकार करें",
    "common.decline": "अस्वीकार करें",
    "common.send": "भेजें",
    "common.offline": "ऑफ़लाइन",
    "common.online": "ऑनलाइन",
    "intro.welcome": "AirTalk स्वागत",
    "intro.selectLanguage": "भाषा चुनें",
    "intro.start": "ऐप शुरू करें",
    "intro.currentLanguage": "वर्तमान भाषा",
    "login.back": "स्वागत पर वापस",
    "login.title": "AirTalk लॉगिन",
    "login.subtitle": "ऑनलाइन लॉगिन या ऑफ़लाइन मोड चुनें।",
    "login.onlineTab": "ऑनलाइन लॉगिन",
    "login.offlineTab": "ऑफ़लाइन मोड",
    "login.password": "पासवर्ड",
    "login.button": "लॉगिन",
    "signup.button": "साइनअप",
    "home.notifications": "सूचनाएं",
    "scan.title": "आसपास स्कैन",
    "scan.start": "रडार स्कैन शुरू करें",
    "scan.defaultSender": "डिफ़ॉल्ट प्रेषक",
    "settings.title": "सेटिंग्स",
    "appearance.language": "ऐप भाषा",
  }),
  Tamil: withBase({
    "common.home": "முகப்பு",
    "common.scan": "ஸ்கேன்",
    "common.settings": "அமைப்புகள்",
    "common.cancel": "ரத்து",
    "common.save": "சேமி",
    "common.accept": "ஏற்க",
    "common.decline": "நிராகரி",
    "common.send": "அனுப்பு",
    "common.offline": "ஆஃப்லைன்",
    "common.online": "ஆன்லைன்",
    "intro.welcome": "AirTalk வரவேற்பு",
    "intro.selectLanguage": "மொழி தேர்வு",
    "intro.start": "ஆப் தொடங்கு",
    "login.back": "வரவேற்புக்கு திரும்பு",
    "login.title": "AirTalk உள்நுழைவு",
    "login.onlineTab": "ஆன்லைன் உள்நுழைவு",
    "login.offlineTab": "ஆஃப்லைன் முறை",
    "login.button": "உள்நுழைவு",
    "signup.button": "பதிவு",
    "scan.title": "அருகில் ஸ்கேன்",
    "settings.title": "அமைப்புகள்",
    "appearance.language": "ஆப் மொழி",
  }),
  Telugu: withBase({
    "common.home": "హోమ్",
    "common.scan": "స్కాన్",
    "common.settings": "సెట్టింగ్స్",
    "common.cancel": "రద్దు",
    "common.save": "సేవ్",
    "common.accept": "అంగీకరించు",
    "common.decline": "తిరస్కరించు",
    "common.send": "పంపు",
    "common.offline": "ఆఫ్‌లైన్",
    "common.online": "ఆన్‌లైన్",
    "intro.selectLanguage": "భాషను ఎంచుకోండి",
    "intro.start": "యాప్ ప్రారంభించు",
    "login.title": "AirTalk లాగిన్",
    "login.button": "లాగిన్",
    "signup.button": "సైన్ అప్",
    "scan.title": "సమీప స్కాన్",
    "settings.title": "సెట్టింగ్స్",
    "appearance.language": "యాప్ భాష",
  }),
  Kannada: withBase({
    "common.home": "ಮುಖಪುಟ",
    "common.scan": "ಸ್ಕ್ಯಾನ್",
    "common.settings": "ಸೆಟ್ಟಿಂಗ್ಸ್",
    "common.cancel": "ರದ್ದು",
    "common.save": "ಉಳಿಸಿ",
    "common.accept": "ಸ್ವೀಕರಿಸಿ",
    "common.decline": "ನಿರಾಕರಿಸಿ",
    "common.send": "ಕಳುಹಿಸಿ",
    "common.offline": "ಆಫ್‌ಲೈನ್",
    "common.online": "ಆನ್‌ಲೈನ್",
    "intro.selectLanguage": "ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ",
    "intro.start": "ಆ್ಯಪ್ ಆರಂಭಿಸಿ",
    "login.title": "AirTalk ಲಾಗಿನ್",
    "login.button": "ಲಾಗಿನ್",
    "signup.button": "ಸೈನ್ ಅಪ್",
    "scan.title": "ಹತ್ತಿರದ ಸ್ಕ್ಯಾನ್",
    "settings.title": "ಸೆಟ್ಟಿಂಗ್ಸ್",
    "appearance.language": "ಆ್ಯಪ್ ಭಾಷೆ",
  }),
  Malayalam: withBase({
    "common.home": "ഹോം",
    "common.scan": "സ്കാൻ",
    "common.settings": "സെറ്റിംഗ്സ്",
    "common.cancel": "റദ്ദാക്കുക",
    "common.save": "സേവ്",
    "common.accept": "സ്വീകരിക്കുക",
    "common.decline": "നിരസിക്കുക",
    "common.send": "അയക്കുക",
    "common.offline": "ഓഫ്‌ലൈൻ",
    "common.online": "ഓൺലൈൻ",
    "intro.selectLanguage": "ഭാഷ തിരഞ്ഞെടുക്കുക",
    "intro.start": "ആപ്പ് തുടങ്ങുക",
    "login.title": "AirTalk ലോഗിൻ",
    "login.button": "ലോഗിൻ",
    "signup.button": "സൈൻ അപ്പ്",
    "scan.title": "സമീപം സ്കാൻ",
    "settings.title": "സെറ്റിംഗ്സ്",
    "appearance.language": "ആപ്പ് ഭാഷ",
  }),
  Spanish: withBase({
    "common.home": "Inicio",
    "common.scan": "Escanear",
    "common.settings": "Ajustes",
    "common.cancel": "Cancelar",
    "common.save": "Guardar",
    "common.accept": "Aceptar",
    "common.decline": "Rechazar",
    "common.send": "Enviar",
    "common.offline": "Sin conexión",
    "common.online": "En línea",
    "intro.welcome": "Bienvenida AirTalk",
    "intro.selectLanguage": "Seleccionar idioma",
    "intro.start": "Iniciar app",
    "intro.currentLanguage": "Idioma actual",
    "login.back": "Volver a bienvenida",
    "login.title": "Acceso AirTalk",
    "login.subtitle": "Elige acceso en línea o modo sin conexión.",
    "login.onlineTab": "Acceso en línea",
    "login.offlineTab": "Modo sin conexión",
    "login.button": "Entrar",
    "signup.button": "Registrarse",
    "home.notifications": "Notificaciones",
    "scan.title": "Escanear cercanos",
    "scan.start": "Iniciar radar",
    "settings.title": "Ajustes",
    "appearance.language": "Idioma de la app",
  }),
  French: withBase({
    "common.home": "Accueil",
    "common.scan": "Scanner",
    "common.settings": "Paramètres",
    "common.cancel": "Annuler",
    "common.save": "Enregistrer",
    "common.accept": "Accepter",
    "common.decline": "Refuser",
    "common.send": "Envoyer",
    "common.offline": "Hors ligne",
    "common.online": "En ligne",
    "intro.welcome": "Bienvenue AirTalk",
    "intro.selectLanguage": "Choisir la langue",
    "intro.start": "Démarrer l'app",
    "login.back": "Retour à l'accueil",
    "login.title": "Connexion AirTalk",
    "login.onlineTab": "Connexion en ligne",
    "login.offlineTab": "Mode hors ligne",
    "login.button": "Connexion",
    "signup.button": "S'inscrire",
    "scan.title": "Scanner à proximité",
    "settings.title": "Paramètres",
    "appearance.language": "Langue de l'app",
  }),
  Arabic: withBase({
    "common.home": "الرئيسية",
    "common.scan": "فحص",
    "common.settings": "الإعدادات",
    "common.cancel": "إلغاء",
    "common.save": "حفظ",
    "common.accept": "قبول",
    "common.decline": "رفض",
    "common.send": "إرسال",
    "common.offline": "غير متصل",
    "common.online": "متصل",
    "intro.welcome": "ترحيب AirTalk",
    "intro.selectLanguage": "اختر اللغة",
    "intro.start": "ابدأ التطبيق",
    "login.back": "العودة للترحيب",
    "login.title": "تسجيل دخول AirTalk",
    "login.onlineTab": "دخول أونلاين",
    "login.offlineTab": "وضع أوفلاين",
    "login.button": "دخول",
    "signup.button": "إنشاء حساب",
    "scan.title": "فحص قريب",
    "settings.title": "الإعدادات",
    "appearance.language": "لغة التطبيق",
  }),
  Chinese: withBase({
    "common.home": "首页",
    "common.scan": "扫描",
    "common.settings": "设置",
    "common.cancel": "取消",
    "common.save": "保存",
    "common.accept": "接受",
    "common.decline": "拒绝",
    "common.send": "发送",
    "common.offline": "离线",
    "common.online": "在线",
    "intro.welcome": "AirTalk 欢迎",
    "intro.selectLanguage": "选择语言",
    "intro.start": "开始应用",
    "intro.currentLanguage": "当前语言",
    "login.back": "返回欢迎页",
    "login.title": "AirTalk 登录",
    "login.onlineTab": "在线登录",
    "login.offlineTab": "离线模式",
    "login.button": "登录",
    "signup.button": "注册",
    "scan.title": "附近扫描",
    "settings.title": "设置",
    "appearance.language": "应用语言",
  }),
};

const fallbackLanguage: AppLanguage = "English";

export const loadAppLanguage = (): AppLanguage => {
  const raw = localStorage.getItem(APP_LANGUAGE_KEY);
  if (!raw) return fallbackLanguage;
  return (appLanguageOptions as readonly string[]).includes(raw) ? (raw as AppLanguage) : fallbackLanguage;
};

export const saveAppLanguage = (language: AppLanguage) => {
  localStorage.setItem(APP_LANGUAGE_KEY, language);
  window.dispatchEvent(new CustomEvent("airtalk-language-change", { detail: language }));
};

export const translate = (language: AppLanguage, key: string, vars?: Record<string, string | number>) => {
  const template = translations[language][key] ?? translations[fallbackLanguage][key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce((acc, [name, value]) => acc.split(`{${name}}`).join(String(value)), template);
};

export const useAppLanguage = () => {
  const [language, setLanguageState] = useState<AppLanguage>(() => loadAppLanguage());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== APP_LANGUAGE_KEY) return;
      setLanguageState(loadAppLanguage());
    };

    const onLocalChange = () => setLanguageState(loadAppLanguage());

    window.addEventListener("storage", onStorage);
    window.addEventListener("airtalk-language-change", onLocalChange as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("airtalk-language-change", onLocalChange as EventListener);
    };
  }, []);

  const setLanguage = (next: AppLanguage) => {
    saveAppLanguage(next);
    setLanguageState(next);
  };

  const t = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  }, [language]);

  return { language, setLanguage, t, languages: appLanguageOptions };
};
