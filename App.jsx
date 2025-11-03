import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { 
  createTheme, ThemeProvider, CssBaseline, Button, Input, Badge, 
  Card, CardContent, Typography, Box, Tabs, Tab, CircularProgress,
  Dialog, DialogTitle, DialogContent, IconButton, Snackbar, Alert
} from "@mui/material";
import { 
  Camera, Search, RefreshCcw, Globe, Info, Star, History as HistoryIcon,
  BarChart2, Compare, Delete, Download, Settings, Close, StarBorder
} from "lucide-react";

// ==================== CONSTANTS ====================

const STORAGE_KEYS = {
  LANG: 'halal_lang',
  THEME: 'halal_theme',
  FAVORITES: 'halal_favorites',
  HISTORY: 'halal_history',
  CACHE: 'halal_cache'
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MAX_HISTORY = 50;

// ==================== I18N ====================

const translations = {
  ar: {
    title: "فاحص الحلال Pro",
    subtitle: "تحقق من المنتجات الغذائية بسهولة",
    barcode: "رقم الباركود",
    scanWithCamera: "استعمل الكاميرا",
    stopCamera: "إيقاف الكاميرا",
    search: "تحقق",
    productInfo: "معلومات المنتج",
    ingredients: "المكوّنات",
    analysis: "التحليل الشرعي",
    halalStatus: "الحكم",
    halal: "حلال ✓",
    doubtful: "مشكوك فيه ⚠",
    haram: "حرام ✗",
    harmfulAdditives: "مضافات ضارة",
    nutrition: "تقييم غذائي",
    nova: "NOVA",
    lang: "EN",
    again: "منتج جديد",
    addToFavorites: "إضافة للمفضلة",
    removeFromFavorites: "إزالة من المفضلة",
    addToCompare: "إضافة للمقارنة",
    compare: "مقارنة",
    tabs: {
      scan: "فحص",
      favorites: "المفضلة",
      history: "السجل",
      stats: "إحصائيات"
    },
    noFavorites: "لا توجد منتجات مفضلة",
    noHistory: "لا يوجد سجل",
    clearHistory: "مسح الكل",
    exportData: "تصدير البيانات",
    totalScans: "إجمالي الفحوصات",
    settings: "الإعدادات",
    darkMode: "الوضع الداكن",
    notifications: "الإشعارات",
    cacheCleared: "تم مسح الذاكرة المؤقتة",
    error: "حدث خطأ",
    notFound: "المنتج غير موجود",
    networkError: "خطأ في الاتصال",
    disclaimer: "هذا تصنيف تجريبي وليس فتوى شرعية. يُنصح بالتحقق من الشهادات الرسمية."
  },
  en: {
    title: "HalalCheck Pro",
    subtitle: "Verify food products easily",
    barcode: "Barcode",
    scanWithCamera: "Use Camera",
    stopCamera: "Stop Camera",
    search: "Check",
    productInfo: "Product Info",
    ingredients: "Ingredients",
    analysis: "Halal Analysis",
    halalStatus: "Status",
    halal: "Halal ✓",
    doubtful: "Doubtful ⚠",
    haram: "Haram ✗",
    harmfulAdditives: "Harmful Additives",
    nutrition: "Nutrition",
    nova: "NOVA",
    lang: "AR",
    again: "New Product",
    addToFavorites: "Add to Favorites",
    removeFromFavorites: "Remove from Favorites",
    addToCompare: "Add to Compare",
    compare: "Compare",
    tabs: {
      scan: "Scan",
      favorites: "Favorites",
      history: "History",
      stats: "Statistics"
    },
    noFavorites: "No favorite products",
    noHistory: "No history",
    clearHistory: "Clear All",
    exportData: "Export Data",
    totalScans: "Total Scans",
    settings: "Settings",
    darkMode: "Dark Mode",
    notifications: "Notifications",
    cacheCleared: "Cache cleared",
    error: "Error occurred",
    notFound: "Product not found",
    networkError: "Network error",
    disclaimer: "This is experimental classification, not a religious ruling. Verify with official halal certifications."
  }
};

// ==================== CLASSIFICATION LOGIC ====================

const HARAM_KEYWORDS = [
  "gelatin", "gélatine", "gelatina", "جلاتين", "جيلاتين", 
  "e441", "pork", "porc", "خنزير", "lard", "saindoux",
  "alcohol", "alcool", "ethanol", "كحول", "wine", "نبيذ", "beer", "بيرة",
  "rennet", "présure", "منفحة حيوانية"
];

const DOUBTFUL_KEYWORDS = [
  "e120", "cochineal", "carmine", "قرمزي",
  "e471", "e472", "e473", "e481", "e482",
  "emulsifier", "مستحلب", "flavour", "نكهة"
];

const HARMFUL_E = [
  "E102", "E110", "E120", "E122", "E124", "E129",
  "E211", "E220", "E250", "E251", "E621"
];

function classifyHalal(ingredientsText = "", labels = [], additives = []) {
  const text = (ingredientsText || "").toLowerCase();
  const reasons = [];
  
  // Check for vegan/vegetarian labels
  const hasVegan = labels.some(l => /vegan|نباتي|végane/i.test(l));
  if (hasVegan) {
    return { verdict: "halal", reasons: ["Vegan label detected"], confidence: "high" };
  }
  
  // Check for haram ingredients
  for (const keyword of HARAM_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      reasons.push(`Found: ${keyword}`);
      return { verdict: "haram", reasons, confidence: "high" };
    }
  }
  
  // Check for doubtful ingredients
  const doubtfulFound = DOUBTFUL_KEYWORDS.filter(k => text.includes(k.toLowerCase()));
  if (doubtfulFound.length > 0) {
    reasons.push(...doubtfulFound.map(k => `Doubtful: ${k}`));
    return { verdict: "doubtful", reasons, confidence: "medium" };
  }
  
  // Check harmful additives
  const harmfulFound = additives.filter(a => 
    HARMFUL_E.some(e => a.toUpperCase().includes(e))
  );
  if (harmfulFound.length > 0) {
    reasons.push("Contains potentially harmful additives");
  }
  
  reasons.push("No haram/doubtful markers detected");
  return { verdict: "halal", reasons, confidence: "medium" };
}

function extractHarmfulAdditives(additives_tags = []) {
  const found = new Set();
  for (const tag of additives_tags || []) {
    const code = tag.split(":").pop()?.toUpperCase();
    if (code && HARMFUL_E.includes(code)) {
      found.add(code);
    }
  }
  return Array.from(found);
}

// ==================== STORAGE UTILITIES ====================

class Storage {
  static get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }
  
  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  
  static remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
}

// ==================== API ====================

class ProductAPI {
  static cache = Storage.get(STORAGE_KEYS.CACHE, {});
  
  static async fetchProduct(barcode) {
    // Check cache first
    const cached = this.cache[barcode];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    
    // Fetch from API
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('API_ERROR');
    }
    
    const json = await response.json();
    
    if (!json?.product) {
      throw new Error('NOT_FOUND');
    }
    
    // Cache the result
    this.cache[barcode] = {
      data: json,
      timestamp: Date.now()
    };
    Storage.set(STORAGE_KEYS.CACHE, this.cache);
    
    return json;
  }
  
  static clearCache() {
    this.cache = {};
    Storage.remove(STORAGE_KEYS.CACHE);
  }
}

// ==================== HOOKS ====================

function useFavorites() {
  const [favorites, setFavorites] = useState(() => 
    Storage.get(STORAGE_KEYS.FAVORITES, [])
  );
  
  const addFavorite = useCallback((product) => {
    setFavorites(prev => {
      const newFavorites = prev.filter(f => f.code !== product.code);
      newFavorites.unshift(product);
      Storage.set(STORAGE_KEYS.FAVORITES, newFavorites);
      return newFavorites;
    });
  }, []);
  
  const removeFavorite = useCallback((code) => {
    setFavorites(prev => {
      const newFavorites = prev.filter(f => f.code !== code);
      Storage.set(STORAGE_KEYS.FAVORITES, newFavorites);
      return newFavorites;
    });
  }, []);
  
  const isFavorite = useCallback((code) => {
    return favorites.some(f => f.code === code);
  }, [favorites]);
  
  return { favorites, addFavorite, removeFavorite, isFavorite };
}

function useHistory() {
  const [history, setHistory] = useState(() => 
    Storage.get(STORAGE_KEYS.HISTORY, [])
  );
  
  const addToHistory = useCallback((product) => {
    setHistory(prev => {
      const newHistory = prev.filter(h => h.code !== product.code);
      newHistory.unshift({ ...product, timestamp: Date.now() });
      const trimmed = newHistory.slice(0, MAX_HISTORY);
      Storage.set(STORAGE_KEYS.HISTORY, trimmed);
      return trimmed;
    });
  }, []);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
    Storage.remove(STORAGE_KEYS.HISTORY);
  }, []);
  
  return { history, addToHistory, clearHistory };
}

// ==================== COMPONENTS ====================

function VerdictBadge({ verdict, t }) {
  const colors = {
    halal: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' },
    doubtful: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' },
    haram: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' }
  };
  
  const color = colors[verdict] || colors.halal;
  
  return (
    <div className={`${color.bg} ${color.text} border-2 ${color.border} px-4 py-2 rounded-xl font-bold text-center`}>
      {t[verdict]}
    </div>
  );
}

function ProductCard({ product, classification, t, onAddFavorite, isFavorite, onAddCompare }) {
  const { p, cls } = product;
  
  return (
    <Card sx={{ borderRadius: 3, mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          {p.image_small_url && (
            <img 
              src={p.image_small_url} 
              alt={p.product_name} 
              style={{ width: 100, height: 100, borderRadius: 12, objectFit: 'cover' }}
            />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              {p.product_name_ar || p.product_name || '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {p.brands || '—'}
            </Typography>
          </Box>
          <IconButton onClick={onAddFavorite}>
            {isFavorite ? <Star fill="gold" color="gold" /> : <StarBorder />}
          </IconButton>
        </Box>
        
        <VerdictBadge verdict={cls.verdict} t={t} />
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {t.analysis}
          </Typography>
          <ul style={{ fontSize: 14, paddingLeft: 20 }}>
            {cls.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Box>
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {t.ingredients}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              bgcolor: 'grey.100', 
              p: 2, 
              borderRadius: 2, 
              fontSize: 13,
              whiteSpace: 'pre-wrap'
            }}
          >
            {p.ingredients_text_ar || p.ingredients_text || '—'}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={onAddCompare}
            startIcon={<Compare size={16} />}
          >
            {t.addToCompare}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function StatisticsView({ history, favorites, t }) {
  const stats = useMemo(() => {
    const total = history.length;
    const halalCount = history.filter(h => h.cls?.verdict === 'halal').length;
    const haramCount = history.filter(h => h.cls?.verdict === 'haram').length;
    const doubtfulCount = total - halalCount - haramCount;
    
    return { total, halalCount, haramCount, doubtfulCount };
  }, [history]);
  
  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" mb={2}>
        {t.tabs.stats}
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
        <Card sx={{ borderRadius: 3, bgcolor: 'primary.light' }}>
          <CardContent>
            <Typography variant="h4" fontWeight="bold">
              {stats.total}
            </Typography>
            <Typography variant="body2">
              {t.totalScans}
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ borderRadius: 3, bgcolor: 'warning.light' }}>
          <CardContent>
            <Typography variant="h4" fontWeight="bold">
              {favorites.length}
            </Typography>
            <Typography variant="body2">
              {t.tabs.favorites}
            </Typography>
          </CardContent>
        </Card>
      </Box>
      
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color="success.main" fontWeight="bold">
                {stats.halalCount}
              </Typography>
              <Typography variant="caption">{t.halal}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color="error.main" fontWeight="bold">
                {stats.haramCount}
              </Typography>
              <Typography variant="caption">{t.haram}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color="warning.main" fontWeight="bold">
                {stats.doubtfulCount}
              </Typography>
              <Typography variant="caption">{t.doubtful}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// ==================== MAIN APP ====================

export default function App() {
  // State
  const [lang, setLang] = useState(() => Storage.get(STORAGE_KEYS.LANG, 'ar'));
  const [darkMode, setDarkMode] = useState(() => Storage.get(STORAGE_KEYS.THEME, false));
  const [currentTab, setCurrentTab] = useState(0);
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentProduct, setCurrentProduct] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Custom hooks
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { history, addToHistory, clearHistory } = useHistory();
  
  const t = useMemo(() => translations[lang], [lang]);
  
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: '#10b981' },
      secondary: { main: '#8b5cf6' }
    },
    typography: {
      fontFamily: lang === 'ar' ? 'Cairo, sans-serif' : 'Inter, sans-serif'
    }
  });
  
  // Persist settings
  useEffect(() => {
    Storage.set(STORAGE_KEYS.LANG, lang);
  }, [lang]);
  
  useEffect(() => {
    Storage.set(STORAGE_KEYS.THEME, darkMode);
  }, [darkMode]);
  
  // Handlers
  const handleSearch = useCallback(async () => {
    const code = barcode.trim();
    if (!code) return;
    
    setLoading(true);
    setError('');
    setCurrentProduct(null);
    
    try {
      const json = await ProductAPI.fetchProduct(code);
      const p = json.product;
      
      const ingredientsText = p.ingredients_text_ar || p.ingredients_text || '';
      const labels = [...(p.labels_tags || []), ...(p.labels || '').split(',')].filter(Boolean);
      const additives = extractHarmfulAdditives(p.additives_tags);
      const cls = classifyHalal(ingredientsText, labels, p.additives_tags || []);
      
      const productData = {
        code: barcode,
        p,
        cls,
        additives,
        timestamp: Date.now()
      };
      
      setCurrentProduct(productData);
      addToHistory(productData);
      
    } catch (err) {
      const message = err.message === 'NOT_FOUND' ? t.notFound : t.networkError;
      setError(message);
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [barcode, t, addToHistory]);
  
  const handleToggleFavorite = useCallback(() => {
    if (!currentProduct) return;
    
    if (isFavorite(currentProduct.code)) {
      removeFavorite(currentProduct.code);
      setSnackbar({ open: true, message: t.removeFromFavorites, severity: 'info' });
    } else {
      addFavorite(currentProduct);
      setSnackbar({ open: true, message: t.addToFavorites, severity: 'success' });
    }
  }, [currentProduct, isFavorite, addFavorite, removeFavorite, t]);
  
  const handleExportData = useCallback(() => {
    const data = { history, favorites, timestamp: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `halal-data-${Date.now()}.json`;
    a.click();
    setSnackbar({ open: true, message: t.exportData + ' ✓', severity: 'success' });
  }, [history, favorites, t]);
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box 
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        sx={{ minHeight: '100vh', bgcolor: 'background.default' }}
      >
        <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {t.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t.subtitle}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton onClick={() => setDarkMode(!darkMode)}>
                {darkMode ? '☀️' : '🌙'}
              </IconButton>
              <Button 
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                startIcon={<Globe size={16} />}
              >
                {t.lang}
              </Button>
            </Box>
          </Box>
          
          {/* Tabs */}
          <Tabs 
            value={currentTab} 
            onChange={(e, v) => setCurrentTab(v)}
            sx={{ mb: 2 }}
          >
            <Tab label={t.tabs.scan} />
            <Tab label={t.tabs.favorites} />
            <Tab label={t.tabs.history} />
            <Tab label={t.tabs.stats} />
          </Tabs>
          
          {/* Tab Content */}
          {currentTab === 0 && (
            <Box>
              <Card sx={{ borderRadius: 3, mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Input
                      fullWidth
                      placeholder={t.barcode}
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button 
                      onClick={handleSearch}
                      disabled={loading}
                      variant="contained"
                    >
                      {loading ? <CircularProgress size={20} /> : <Search size={20} />}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
              
              {currentProduct && (
                <ProductCard
                  product={currentProduct}
                  t={t}
                  onAddFavorite={handleToggleFavorite}
                  isFavorite={isFavorite(currentProduct.code)}
                  onAddCompare={() => {}}
                />
              )}
            </Box>
          )}
          
          {currentTab === 1 && (
            <Box>
              {favorites.length === 0 ? (
                <Typography textAlign="center" color="text.secondary" py={4}>
                  {t.noFavorites}
                </Typography>
              ) : (
                favorites.map((fav) => (
                  <ProductCard
                    key={fav.code}
                    product={fav}
                    t={t}
                    onAddFavorite={() => removeFavorite(fav.code)}
                    isFavorite={true}
                    onAddCompare={() => {}}
                  />
                ))
              )}
            </Box>
          )}
          
          {currentTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{t.tabs.history}</Typography>
                <Button 
                  size="small" 
                  color="error"
                  onClick={clearHistory}
                  startIcon={<Delete size={16} />}
                >
                  {t.clearHistory}
                </Button>
              </Box>
              {history.length === 0 ? (
                <Typography textAlign="center" color="text.secondary" py={4}>
                  {t.noHistory}
                </Typography>
              ) : (
                history.map((item) => (
                  <Card 
                    key={item.code} 
                    sx={{ mb: 1, cursor: 'pointer', borderRadius: 2 }}
                    onClick={() => {
                      setBarcode(item.code);
                      setCurrentTab(0);
                      handleSearch();
                    }}
                  >
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {item.p?.product_name_ar || item.p?.product_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(item.timestamp).toLocaleDateString(lang)}
                      </Typography>
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>
          )}
          
          {currentTab === 3 && (
            <Box>
              <StatisticsView history={history} favorites={favorites} t={t} />
              <Button
                fullWidth
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={handleExportData}
                startIcon={<Download size={16} />}
              >
                {t.exportData}
              </Button>
            </Box>
          )}
        </Box>
        
        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
