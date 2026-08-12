import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Application & Firestore
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(firebaseApp);

// Server-side persistent User Store Backup
const USERS_FILE = path.join(process.cwd(), 'data_users.json');
const serverUsersMap = new Map<string, any>();

// Seed default admin account
const DEFAULT_ADMIN_ACCOUNT = {
  id: 'usr-admin-001',
  username: 'admin',
  password: '123',
  fullName: 'System Administrator',
  storeNameKh: 'MINI POS HQ',
  storeNameEn: 'MINI POS HQ',
  phone: '012 345 678',
  role: 'admin',
  status: 'active',
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  totalSalesCount: 0,
  deviceType: 'Desktop',
  deviceIp: '127.0.0.1',
  hidePageButton: false,
};
serverUsersMap.set(DEFAULT_ADMIN_ACCOUNT.id, DEFAULT_ADMIN_ACCOUNT);

// Try loading existing user store from disk
try {
  if (!process.env.VERCEL && fs.existsSync(USERS_FILE)) {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((u) => {
        if (u && u.id) serverUsersMap.set(u.id, u);
      });
    }
  }
} catch (e) {
  console.warn('Error reading data_users.json:', e);
}

function persistServerUsers() {
  if (process.env.VERCEL) return;
  try {
    const arr = Array.from(serverUsersMap.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error saving data_users.json:', e);
  }
}

export const app = express();
app.use(express.json({ limit: '10mb' }));

// API Routes

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

  // Firebase Firestore Connection & Status Check
  const statusHandler = async (_req: express.Request, res: express.Response) => {
    try {
      let docCount = 0;
      try {
        const snap = await getDocs(collection(db, 'sales'));
        docCount = snap.size;
      } catch (e: any) {
        console.warn('Backend Firestore status warning:', e?.message);
      }

      return res.json({
        success: true,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        status: 'CONNECTED',
        docCount,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to connect to Firebase Firestore',
        status: 'DISCONNECTED',
      });
    }
  };

  app.get('/api/firebase/status', statusHandler);
  app.get('/api/supabase/status', statusHandler); // Backwards compatibility

  // Firebase Checkout / Order Save Endpoint
  const checkoutHandler = async (req: express.Request, res: express.Response) => {
    try {
      const order = req.body;
      if (!order || !order.id) {
        return res.status(400).json({ success: false, error: 'Order data with id is required' });
      }

      try {
        const saleRef = doc(db, 'sales', order.id);
        await setDoc(saleRef, order, { merge: true });
      } catch (e: any) {
        console.warn('Backend Firestore checkout save note:', e?.message);
      }

      return res.json({
        success: true,
        orderId: order.id,
        projectId: firebaseConfig.projectId,
      });
    } catch (err: any) {
      console.error('Firebase checkout save error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to save checkout to Firebase' });
    }
  };

  app.post('/api/firebase/checkout', checkoutHandler);
  app.post('/api/supabase/checkout', checkoutHandler);

  // Firebase Get Recent Checkouts
  const getCheckoutsHandler = async (_req: express.Request, res: express.Response) => {
    try {
      const records: any[] = [];
      try {
        const snap = await getDocs(collection(db, 'sales'));
        snap.forEach((docSnap) => {
          records.push({ id: docSnap.id, ...docSnap.data() });
        });
      } catch (e: any) {
        console.warn('Backend Firestore getCheckouts warning:', e?.message);
      }

      return res.json({
        success: true,
        count: records.length,
        checkouts: records,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.get('/api/firebase/checkouts', getCheckoutsHandler);
  app.get('/api/supabase/checkouts', getCheckoutsHandler);

  // Save/Register User Endpoint
  const saveUserHandler = async (req: express.Request, res: express.Response) => {
    try {
      const user = req.body;
      if (!user || !user.id) {
        return res.status(400).json({ success: false, error: 'User data with id is required' });
      }

      serverUsersMap.set(user.id, user);
      persistServerUsers();

      try {
        const userRef = doc(db, 'users', user.id);
        await setDoc(userRef, user, { merge: true });
      } catch (e) {}

      return res.json({ success: true, userId: user.id, totalUsers: serverUsersMap.size });
    } catch (err: any) {
      console.error('User save error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post('/api/firebase/user', saveUserHandler);
  app.post('/api/supabase/user', saveUserHandler);

  // Delete User Endpoint
  const deleteUserHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { userId } = req.body;
      if (userId) {
        serverUsersMap.delete(userId);
        persistServerUsers();
        try {
          const userRef = doc(db, 'users', userId);
          await deleteDoc(userRef);
        } catch (e) {}
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post('/api/firebase/user/delete', deleteUserHandler);
  app.post('/api/supabase/user/delete', deleteUserHandler);

  // Update User Status Endpoint
  const userStatusHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { userId, status } = req.body;
      if (userId && serverUsersMap.has(userId)) {
        const u = serverUsersMap.get(userId);
        u.status = status;
        serverUsersMap.set(userId, u);
        persistServerUsers();
        try {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, { status });
        } catch (e) {}
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post('/api/firebase/user/status', userStatusHandler);
  app.post('/api/supabase/user/status', userStatusHandler);

  // Update User Button Visibility Endpoint
  const userButtonHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { userId, hidePageButton } = req.body;
      if (userId && serverUsersMap.has(userId)) {
        const u = serverUsersMap.get(userId);
        u.hidePageButton = hidePageButton;
        serverUsersMap.set(userId, u);
        persistServerUsers();
        try {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, { hidePageButton });
        } catch (e) {}
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post('/api/firebase/user/button', userButtonHandler);
  app.post('/api/supabase/user/button', userButtonHandler);

  // Update User Active Ping Endpoint
  const userPingHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { userId, isOnline } = req.body;
      if (userId && serverUsersMap.has(userId)) {
        const u = serverUsersMap.get(userId);
        u.isOnline = isOnline;
        u.lastActiveAt = new Date().toISOString();
        serverUsersMap.set(userId, u);
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post('/api/firebase/user/ping', userPingHandler);
  app.post('/api/supabase/user/ping', userPingHandler);

  // Get Users Endpoint
  const getUsersHandler = async (_req: express.Request, res: express.Response) => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          serverUsersMap.set(docSnap.id, { ...data, id: docSnap.id });
        });
        persistServerUsers();
      }
      const usersList = Array.from(serverUsersMap.values());
      return res.json({ success: true, users: usersList });
    } catch (err: any) {
      const usersList = Array.from(serverUsersMap.values());
      return res.json({ success: true, users: usersList });
    }
  };

  app.get('/api/firebase/users', getUsersHandler);
  app.get('/api/supabase/users', getUsersHandler);

  // Test Telegram Bot credentials
  app.post('/api/telegram/test', async (req, res) => {
    try {
      const { botToken, chatId } = req.body;
      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, error: 'Bot token and Chat ID are required' });
      }

      const meResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const meData = await meResponse.json();

      if (!meData.ok) {
        return res.status(400).json({ success: false, error: meData.description || 'Invalid Telegram Bot Token' });
      }

      // Send a test message
      const testMsgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔔 *Mart System Connected Successfully!*\n\nBot: @${meData.result.username}\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' })}\n\n✅ System is ready to send POS receipts & daily sales reports.`,
          parse_mode: 'Markdown',
        }),
      });

      const testMsgData = await testMsgResponse.json();
      if (!testMsgData.ok) {
        return res.status(400).json({ success: false, error: testMsgData.description || 'Failed to send test message to Chat ID' });
      }

      return res.json({ success: true, botName: meData.result.first_name, username: meData.result.username });
    } catch (err: any) {
      console.error('Telegram test error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // Send Telegram message (Receipt, Daily Report, Low Stock alert)
  app.post('/api/telegram/send', async (req, res) => {
    try {
      const { botToken, chatId, message, parseMode = 'HTML' } = req.body;

      if (!botToken || !chatId || !message) {
        return res.status(400).json({ success: false, error: 'Missing botToken, chatId, or message' });
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: parseMode,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        return res.status(400).json({ success: false, error: data.description });
      }

      return res.json({ success: true, messageId: data.result.message_id });
    } catch (err: any) {
      console.error('Telegram send error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Server error sending Telegram message' });
    }
  });

  // Gemini AI Product Helper / Lookup
  app.post('/api/ai/product-lookup', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'Gemini API key is not configured.' });
      }

      const { prompt, barcode } = req.body;
      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `You are an AI assistant specialized in retail Mart inventory management in Cambodia (Khmer + English).
Given a barcode or product search term, output JSON with fields:
- barcode (string)
- nameKh (string, Khmer product name)
- nameEn (string, English product name)
- category (string, e.g. "Beverages", "Snacks", "Dairy", "Personal Care", "Fresh Food", "Groceries", "Household")
- priceUsd (number, estimated retail price in USD, e.g. 1.25)
- priceKhr (number, estimated retail price in KHR, e.g. 5000)
- unit (string, e.g. "Bottle", "Can", "Pack", "Box", "Kg", "Pcs")
- description (string in Khmer)

Provide realistic retail prices for items in Cambodia (4100 KHR per USD standard).
Return ONLY clean valid JSON without markdown wrapping.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${systemPrompt}\n\nSearch context: Barcode="${barcode || ''}", Prompt="${prompt || ''}"`,
      });

      const text = response.text || '';
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanJson);

      return res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('AI Product lookup error:', err);
      return res.status(500).json({ success: false, error: err.message || 'AI Lookup failed' });
    }
  });

async function startServer() {
  const PORT = 3000;

  // Vite Middleware handling
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mart POS Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;

